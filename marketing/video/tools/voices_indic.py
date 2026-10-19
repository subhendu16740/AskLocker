"""Speaks the family film's voice scene in each of the app's ten voice
languages: Maa's question, and the app reading its answer back to her.

    python tools/voices_indic.py                 every language
    python tools/voices_indic.py --langs en,ta   some of them

writes audio/voices/lang/<lang>-ask.wav and <lang>-answer.wav, and
src/voices-langs.js with each line's length and the moments in it the film
times to (the same three tools/voices.py writes for the full film's Hindi).
The WAVs are committed, so the film renders without this step.

The voices are AI4Bharat's Indic Parler-TTS (Apache 2.0), which speaks every
one of these languages from text, trained on Indian speakers; Kokoro, which
speaks the full film's Hindi, has no voices for the others. The model is gated
on Hugging Face: accept its terms there, and set HF_TOKEN to a read token.

Needs: pip install torch parler-tts soundfile scipy (parler-tts pins its own
transformers). On a CPU each line takes a minute or two.

The screen shows the lines with numbers in digits (src/voice-lines.js); here
they are written as the voice should say them: the policy number letter by
letter and in groups, as the app's toSpeech() hands it to the phone's voice,
and the date in words, so the model never has to guess how to read a digit.
"""
import argparse
import json
import os
import pathlib
import re
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 24_000

# Each language: Maa's voice and the app's (two of the model's named speakers,
# never the same one), her question, and the answer in three takes: the words
# up to the policy number, the number with whatever closes the sentence, and
# the second sentence.
LINES = {
    'en': dict(maa='Mary', app='Thoma',
               ask="What's Papa's health insurance policy number?",
               lead="Papa's health insurance policy number is",
               number='A S H two, three one one four, five eight nine.',
               a2="It's valid till fourteen March, twenty twenty-seven."),
    'hi': dict(maa='Divya', app='Rohit',
               ask='पापा की हेल्थ इंश्योरेंस का पॉलिसी नंबर क्या है?',
               lead='पापा की हेल्थ इंश्योरेंस पॉलिसी का नंबर',
               number='ए एस एच दो, तीन एक एक चार, पाँच आठ नौ है।',
               a2='यह पॉलिसी चौदह मार्च दो हज़ार सत्ताईस तक वैलिड है।'),
    'bn': dict(maa='Aditi', app='Arjun',
               ask='বাবার হেলথ ইনস্যুরেন্সের পলিসি নম্বরটা কী?',
               lead='বাবার হেলথ ইনস্যুরেন্স পলিসির নম্বর',
               number='এ এস এইচ দুই, তিন এক এক চার, পাঁচ আট নয়।',
               a2='এই পলিসি চোদ্দো মার্চ দু হাজার সাতাশ পর্যন্ত ভ্যালিড।'),
    'ta': dict(maa='Jaya', app='Kavitha',
               ask='அப்பாவோட ஹெல்த் இன்சூரன்ஸ் பாலிசி நம்பர் என்ன?',
               lead='அப்பாவோட ஹெல்த் இன்சூரன்ஸ் பாலிசி நம்பர்',
               number='ஏ எஸ் ஹெச் இரண்டு, மூன்று ஒன்று ஒன்று நான்கு, ஐந்து எட்டு ஒன்பது.',
               a2='இந்த பாலிசி பதினான்கு மார்ச் இரண்டாயிரத்து இருபத்தேழு வரை செல்லும்.'),
    'te': dict(maa='Lalitha', app='Prakash',
               ask='నాన్న హెల్త్ ఇన్సూరెన్స్ పాలసీ నంబర్ ఏంటి?',
               lead='నాన్న హెల్త్ ఇన్సూరెన్స్ పాలసీ నంబర్',
               number='ఏ ఎస్ హెచ్ రెండు, మూడు ఒకటి ఒకటి నాలుగు, ఐదు ఎనిమిది తొమ్మిది.',
               a2='ఈ పాలసీ పద్నాలుగు మార్చి రెండు వేల ఇరవై ఏడు వరకు చెల్లుతుంది.'),
    'mr': dict(maa='Sunita', app='Sanjay',
               ask='बाबांच्या हेल्थ इन्शुरन्सचा पॉलिसी नंबर काय आहे?',
               lead='बाबांच्या हेल्थ इन्शुरन्स पॉलिसीचा नंबर',
               number='ए एस एच दोन, तीन एक एक चार, पाच आठ नऊ आहे.',
               a2='ही पॉलिसी चौदा मार्च दोन हजार सत्तावीस पर्यंत वैध आहे.'),
    'gu': dict(maa='Neha', app='Yash',
               ask='પપ્પાના હેલ્થ ઇન્શ્યોરન્સનો પોલિસી નંબર શું છે?',
               lead='પપ્પાના હેલ્થ ઇન્શ્યોરન્સ પોલિસીનો નંબર',
               number='એ એસ એચ બે, ત્રણ એક એક ચાર, પાંચ આઠ નવ છે.',
               a2='આ પોલિસી ચૌદ માર્ચ બે હજાર સત્તાવીસ સુધી માન્ય છે.'),
    'kn': dict(maa='Anu', app='Suresh',
               ask='ಅಪ್ಪನ ಹೆಲ್ತ್ ಇನ್ಶೂರೆನ್ಸ್ ಪಾಲಿಸಿ ನಂಬರ್ ಏನು?',
               lead='ಅಪ್ಪನ ಹೆಲ್ತ್ ಇನ್ಶೂರೆನ್ಸ್ ಪಾಲಿಸಿ ನಂಬರ್',
               number='ಎ ಎಸ್ ಎಚ್ ಎರಡು, ಮೂರು ಒಂದು ಒಂದು ನಾಲ್ಕು, ಐದು ಎಂಟು ಒಂಬತ್ತು.',
               a2='ಈ ಪಾಲಿಸಿ ಹದಿನಾಲ್ಕು ಮಾರ್ಚ್ ಎರಡು ಸಾವಿರದ ಇಪ್ಪತ್ತೇಳರ ವರೆಗೆ ಮಾನ್ಯವಾಗಿರುತ್ತದೆ.'),
    'ml': dict(maa='Anjali', app='Harish',
               ask='അച്ഛന്റെ ഹെൽത്ത് ഇൻഷുറൻസ് പോളിസി നമ്പർ എന്താ?',
               lead='അച്ഛന്റെ ഹെൽത്ത് ഇൻഷുറൻസ് പോളിസി നമ്പർ',
               number='എ എസ് എച്ച് രണ്ട്, മൂന്ന് ഒന്ന് ഒന്ന് നാല്, അഞ്ച് എട്ട് ഒമ്പത് ആണ്.',
               a2='ഈ പോളിസിക്ക് പതിനാല് മാർച്ച് രണ്ടായിരത്തി ഇരുപത്തിയേഴ് വരെ സാധുതയുണ്ട്.'),
    'pa': dict(maa='Gurpreet', app='Divjot',
               ask='ਪਾਪਾ ਦੀ ਹੈਲਥ ਇੰਸ਼ੋਰੈਂਸ ਦਾ ਪਾਲਿਸੀ ਨੰਬਰ ਕੀ ਹੈ?',
               lead='ਪਾਪਾ ਦੀ ਹੈਲਥ ਇੰਸ਼ੋਰੈਂਸ ਪਾਲਿਸੀ ਦਾ ਨੰਬਰ',
               number='ਏ ਐੱਸ ਐੱਚ ਦੋ, ਤਿੰਨ ਇੱਕ ਇੱਕ ਚਾਰ, ਪੰਜ ਅੱਠ ਨੌਂ ਹੈ।',
               a2='ਇਹ ਪਾਲਿਸੀ ਚੌਦਾਂ ਮਾਰਚ ਦੋ ਹਜ਼ਾਰ ਸਤਾਈ ਤੱਕ ਵੈਲਿਡ ਹੈ।'),
}

# How each speaker is asked to sound: Maa a little slower, as she was in the
# Hindi; the app even and clear. Parler-TTS reads these as plain English.
STYLE = {
    'maa': '{name} speaks at a slightly slow pace with a natural, conversational tone. '
           'The recording is very clear and close-sounding, with no background noise.',
    'app': '{name} speaks clearly at a moderate pace with a calm, friendly tone. '
           'The recording is very clear and close-sounding, with no background noise.',
}
NUMBER_GAP = 0.15    # between the words and the number they lead to
SENTENCE_GAP = 0.4   # between the answer's two sentences, as tools/voices.py
SEEDS = (7, 11, 23)  # a take that reads too fast or too slow is taken again


class Parler:
    def __init__(self, model):
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer
        self.torch = torch
        token = os.environ.get('HF_TOKEN')
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(model, token=token).eval()
        self.tokenizer = AutoTokenizer.from_pretrained(model, token=token)
        self.describe = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path, token=token)
        self.rate = self.model.config.sampling_rate

    def say(self, text, speaker, style):
        """One take of the text as audio at SR, trimmed. The model samples, so a
        take is redrawn with another seed when its pace is far off the text's
        length (a word swallowed, or one said twice)."""
        from scipy.signal import resample_poly
        description = STYLE[style].format(name=speaker)
        d = self.describe(description, return_tensors='pt')
        p = self.tokenizer(text, return_tensors='pt')
        letters = len(re.sub(r'[\s,.!?।]', '', text))
        best = None
        for seed in SEEDS:
            self.torch.manual_seed(seed)
            with self.torch.no_grad():
                out = self.model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask,
                                          prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
            x = out.cpu().numpy().squeeze().astype(np.float64)
            x = resample_poly(x, SR, self.rate)
            x, _ = trim(x)
            per = len(x) / SR / max(1, letters)
            print(f'      seed {seed}: {len(x) / SR:.2f}s, {per * 1000:.0f} ms a letter')
            if best is None or abs(np.log(per / 0.075)) < abs(np.log(best[1] / 0.075)):
                best = (x, per)
            if 0.045 <= per <= 0.13:
                break
        return level(best[0])


def trim(x, pad=0.03):
    """Cut the silence at both ends, keeping a breath of it. The floor follows
    the take's own loudness, since takes differ."""
    floor = 0.02 * np.max(np.abs(x))
    loud = np.where(np.abs(x) > floor)[0]
    a = max(0, loud[0] - int(pad * SR))
    b = min(len(x), loud[-1] + int(pad * SR))
    out = x[a:b].copy()
    fade = int(0.01 * SR)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out, a / SR


def level(x, rms=0.08):
    """Every take at the same loudness, so the answer's three takes sound like
    one breath."""
    return x * rms / max(1e-9, np.sqrt(np.mean(x ** 2)))


def write_wav(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x / max(1e-9, np.max(np.abs(x))) * 0.89, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--langs', default=','.join(LINES), help='comma-separated codes (default: all ten)')
    ap.add_argument('--model', default='ai4bharat/indic-parler-tts', help='Hugging Face id or a local folder')
    args = ap.parse_args()
    langs = [c for c in args.langs.split(',') if c]
    unknown = [c for c in langs if c not in LINES]
    if unknown:
        raise SystemExit(f'No lines for {unknown}; known: {", ".join(LINES)}')
    tts = Parler(args.model)

    js = ROOT / 'src' / 'voices-langs.js'
    found = re.search(r'LANG_VOICES = (\{.*\});', js.read_text(), re.S) if js.exists() else None
    marks = json.loads(found.group(1)) if found else {}
    for lang in langs:
        line = LINES[lang]
        print(lang)
        print('   ask')
        ask = tts.say(line['ask'], line['maa'], 'maa')
        print('   answer')
        lead = tts.say(line['lead'], line['app'], 'app')
        number = tts.say(line['number'], line['app'], 'app')
        a2 = tts.say(line['a2'], line['app'], 'app')
        gap1, gap2 = np.zeros(int(NUMBER_GAP * SR)), np.zeros(int(SENTENCE_GAP * SR))
        answer = np.concatenate([lead, gap1, number, gap2, a2])
        write_wav(ROOT / 'audio' / 'voices' / 'lang' / f'{lang}-ask.wav', ask)
        write_wav(ROOT / 'audio' / 'voices' / 'lang' / f'{lang}-answer.wav', answer)
        marks[lang] = {
            'ask': {'dur': round(len(ask) / SR, 3)},
            'answer': {
                'dur': round(len(answer) / SR, 3),
                # Halfway through the pause before the number's first letter.
                'number': round((len(lead) + len(gap1) / 2) / SR, 3),
                'sentence2': round((len(lead) + len(gap1) + len(number) + len(gap2)) / SR, 3),
            },
        }
        print(f'   {json.dumps(marks[lang])}')

    js.write_text(
        '// Written by tools/voices_indic.py: for each voice language, how long its\n'
        '// spoken lines run, in seconds, and the moments in them the film times to.\n'
        '// Regenerate rather than edit.\n'
        f'export const LANG_VOICES = {json.dumps(dict(sorted(marks.items())), indent=2, ensure_ascii=False)};\n')
    print(js)


if __name__ == '__main__':
    main()
