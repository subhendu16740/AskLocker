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
on Hugging Face: accept its terms there and set HF_TOKEN to a read token, or
pass --model a folder holding its files.

Needs: pip install torch torchaudio parler-tts scipy (parler-tts pins its own
transformers). The languages are spoken together, a batch of ten lines at a
time, which on a 4-core CPU takes four to six minutes.

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
import time
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 24_000

# Each language: Maa's voice and the app's (two of the model's named speakers,
# never the same one), her question, and the answer: the words up to the policy
# number, the number with whatever closes the sentence, and the second sentence.
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
SENTENCE_GAP = 0.4       # between the answer's two sentences, as tools/voices.py
SEEDS = (7, 11, 23, 31)  # a take that fails its check is drawn again
HOP = 0.01               # seconds between the frames the checks and the timing read


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

    def batch(self, items, seed):
        """Each (name, text, speaker, style) said once, all in one batch: on a
        CPU ten lines take about four times as long as one. Audio at SR."""
        from scipy.signal import resample_poly
        d = self.describe([STYLE[style].format(name=speaker) for _, _, speaker, style in items],
                          return_tensors='pt', padding=True)
        p = self.tokenizer([text for _, text, _, _ in items], return_tensors='pt', padding=True)
        self.torch.manual_seed(seed)
        with self.torch.no_grad():
            out = self.model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask,
                                      prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask,
                                      return_dict_in_generate=True)
        return [resample_poly(out.sequences[i, :n].cpu().numpy().astype(np.float64), SR, self.rate)
                for i, n in enumerate(out.audios_length)]

    def takes(self, items, what):
        """One good take of each item, trimmed and levelled. The model samples,
        so a take now and then swallows a word, says one twice or stops to
        think: one whose pace is far off its text's length, or that pauses too
        long, is drawn again with the next seed, and if none passes, the
        nearest is kept."""
        best = [None] * len(items)
        todo = list(range(len(items)))
        for seed in SEEDS:
            if not todo:
                break
            t = time.time()
            said = self.batch([items[i] for i in todo], seed)
            print(f'{what}: {len(todo)} in {time.time() - t:.0f}s, seed {seed}', flush=True)
            again = []
            for i, x in zip(todo, said):
                x, _ = trim(x)
                off, why = check(x, items[i][1])
                print(f'   {items[i][0]}: {len(x) / SR:.2f}s{"  " + why if why else ""}', flush=True)
                if best[i] is None or off < best[i][1]:
                    best[i] = (x, off)
                if why:
                    again.append(i)
            todo = again
        return [level(x) for x, _ in best]


def check(x, text):
    """How far a take is from passing (0 when it passes), and why it fails."""
    letters = len(re.sub(r'[\s,.!?।]', '', text))
    per = len(x) / SR / max(1, letters)
    longest = max((b - a for a, b in pauses(x)), default=0.0)
    off = max(0.0, np.log(0.04 / per), np.log(per / 0.15)) + max(0.0, longest - 0.7)
    why = [f'{per * 1000:.0f} ms a letter'] if not 0.04 <= per <= 0.15 else []
    why += [f'a {longest:.1f}s pause'] if longest > 0.7 else []
    return off, ', '.join(why)


def pauses(x, shortest=0.04):
    """The quiet stretches inside a take, as (start, end) in seconds: frames
    under a tenth of its speech's loudness, at least `shortest` long."""
    hop = int(HOP * SR)
    rms = np.sqrt(np.mean(x[: len(x) // hop * hop].reshape(-1, hop) ** 2, axis=1))
    quiet = rms < 0.1 * np.percentile(rms, 90)
    out, start = [], None
    for i, q in enumerate([*quiet, False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if start > 0 and i < len(rms) and (i - start) * HOP >= shortest:
                out.append((start * HOP, i * HOP))
            start = None
    return out


def speech(x):
    """Log-mel frames of a take's speech, HOP apart, each band normalised, and
    each frame's time. Its pauses are left out: the same words are said with
    pauses in different places, and a pause matches nothing."""
    import torch
    import torchaudio
    mel = torchaudio.transforms.MelSpectrogram(sample_rate=SR, n_fft=1024, win_length=600,
                                               hop_length=int(HOP * SR), n_mels=40)(torch.from_numpy(x).float()).numpy()
    loud = np.sqrt(mel.sum(0))
    keep = np.flatnonzero(loud >= 0.1 * np.percentile(loud, 90))
    f = np.log(mel[:, keep] + 1e-5).T
    return (f - f.mean(0)) / (f.std(0) + 1e-5), keep * HOP


def number_onset(lead, sentence):
    """Where the policy number starts in the answer's first sentence, which is
    said in one take so it flows. The words before the number, said alone, are
    matched against the sentence's start by dynamic time warping (each side at
    most twice the other's pace, the end left free): their last frame lands
    where the number begins. A pause there is split down the middle, as
    tools/voices.py does."""
    from scipy.spatial.distance import cdist
    a, _ = speech(lead)
    b, times = speech(sentence)
    cost = cdist(a, b, 'cosine')
    n, m = cost.shape
    acc = np.full((n, m), np.inf)
    acc[0, 0] = cost[0, 0]
    for i in range(n):
        for j in range(m):
            c = cost[i, j]
            best = np.inf
            if i and j:
                best = acc[i - 1, j - 1] + 2 * c
            if i and j > 1:
                best = min(best, acc[i - 1, j - 2] + 2 * cost[i, j - 1] + c)
            if i > 1 and j:
                best = min(best, acc[i - 2, j - 1] + 2 * cost[i - 1, j] + c)
            if i or j:
                acc[i, j] = best
    end = int(np.argmin(acc[n - 1] / (n + np.arange(1, m + 1))))
    t = times[end] + HOP
    for p, q in pauses(sentence):
        if p - 0.1 <= t <= q:
            return (p + q) / 2
    return t


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
    """Every take at the same loudness, so the answer's two sentences sound
    like one voice."""
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

    # Four batches, each line in every language at once: Maa's question, the
    # answer's first sentence (its words and the number in one take), those
    # words alone (only to find where the number starts), the second sentence.
    lines = [(lang, LINES[lang]) for lang in langs]
    asks = tts.takes([(lang, l['ask'], l['maa'], 'maa') for lang, l in lines], 'questions')
    firsts = tts.takes([(lang, f"{l['lead']} {l['number']}", l['app'], 'app') for lang, l in lines], 'first sentences')
    leads = tts.takes([(lang, l['lead'], l['app'], 'app') for lang, l in lines], 'words before the number')
    seconds = tts.takes([(lang, l['a2'], l['app'], 'app') for lang, l in lines], 'second sentences')

    js = ROOT / 'src' / 'voices-langs.js'
    found = re.search(r'LANG_VOICES = (\{.*\});', js.read_text(), re.S) if js.exists() else None
    marks = json.loads(found.group(1)) if found else {}
    gap = np.zeros(int(SENTENCE_GAP * SR))
    for (lang, _), ask, first, lead, second in zip(lines, asks, firsts, leads, seconds):
        answer = np.concatenate([first, gap, second])
        write_wav(ROOT / 'audio' / 'voices' / 'lang' / f'{lang}-ask.wav', ask)
        write_wav(ROOT / 'audio' / 'voices' / 'lang' / f'{lang}-answer.wav', answer)
        marks[lang] = {
            'ask': {'dur': round(len(ask) / SR, 3)},
            'answer': {
                'dur': round(len(answer) / SR, 3),
                'number': round(number_onset(lead, first), 3),
                'sentence2': round((len(first) + len(gap)) / SR, 3),
            },
        }
        print(lang, json.dumps(marks[lang]))

    js.write_text(
        '// Written by tools/voices_indic.py: for each voice language, how long its\n'
        '// spoken lines run, in seconds, and the moments in them the film times to.\n'
        '// Regenerate rather than edit.\n'
        f'export const LANG_VOICES = {json.dumps(dict(sorted(marks.items())), indent=2, ensure_ascii=False)};\n')
    print(js)


if __name__ == '__main__':
    main()
