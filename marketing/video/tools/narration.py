"""Speaks the family film's narration, in English: a guide who says, in a
sentence, what each scene is about, while the screen shows it. It never reads
the screen out, and it is quiet where the film speaks for itself (the cold
open, "Your family won't", the call nobody answers) and wherever someone in
the film is speaking.

    python3 tools/narration.py --model model.onnx --voices voices/ [--voice af_heart]

writes audio/voices/narration/en/<line>.wav and src/narration.js (each line's
length, which the film checks against its scene). The film says them with
?narration=en (tools/render.mjs --narration en); src/family.js places each
line in its scene, and audio/score.py lowers the music under it. The WAVs are
committed, so the film renders without this step: run it again only to change
a line or the voice, then re-render.

The voice is Kokoro-82M v1.0 (Apache 2.0), as in tools/voices.py, reading
misaki's English phonemes, the way Kokoro's own pipeline reads English.
  --model   onnx/model.onnx from huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
  --voices  that repository's voices/ folder
  --voice   af_heart unless named (a- American, b- British: misaki follows it)

Needs what tools/voices.py needs, and misaki:
  pip install numpy onnx onnxruntime phonemizer-fork
  pip install --no-deps misaki num2words && pip install addict regex spacy espeakng-loader
  python3 -m spacy download en_core_web_sm; apt install espeak-ng
(num2words wants docopt only for its command line, and docopt no longer builds
on recent setuptools, hence --no-deps.)
"""
import argparse
import json
import pathlib
import re
import sys
import wave

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from voices import Kokoro, SR  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent

# One line a scene, in the film's order, keyed by where src/family.js places it.
# Said as a person would say it: "Ask Locker" in two words, so both are
# stressed, and a name the dictionary does not know with its sounds given
# ([word](/phonemes/), misaki's own way).
LINES = {
    'scramble': 'Everything you need is somewhere. Just not where you can reach it, at two in the morning.',
    'stat': "That's how so much money in India goes unclaimed.",
    'reveal': 'Meet Ask Locker. Every family document, one question away.',
    'gmail': 'With Family Plus, it even finds the policies buried in your email, and brings in only the ones you tick.',
    'scan': 'Originals in a cupboard back home? Photograph them once. Ask Locker reads each page, '
            'and picks out the policy number and expiry date.',
    'ask': 'Then whoever needs something just asks. The answer comes from your own documents, with its source.',
    'voice': "Maa doesn't type. She just asks.",
    'voice2': 'In her own language.',
    'tree': "Everyone's in one family tree, even those who never sign in. So asking for [Dadi's](/dˈɑːdiːz/) policy just works.",
    'emerg': 'Each person has an emergency card, with everything a doctor asks for first.',
    'alerts': 'And with Family Plus, the whole family is reminded before a policy or passport runs out.',
    'trust': "These are your family's most private papers. In Ask Locker, only your family can open them.",
    'res': 'And nobody had to pick up.',
    'end': 'Start your family vault today. It is free to start.',
}

# What no film may say (CLAUDE.md, Conventions: never promise more privacy
# than AskLocker gives; and the owner's: no "no ads").
FORBIDDEN = ['secure', 'safe', 'private and isolated', '100% private', 'only you can see', 'nothing is kept',
             'no ads', 'end-to-end', 'end to end', 'military', 'bank-level', 'unhackable', 'zero-knowledge']

# Every line at one loudness: the RMS of its speech, in dBFS.
TARGET_RMS_DB = -17.5


class English(Kokoro):
    def __init__(self, model, voices, voice):
        super().__init__(model, voices)
        from misaki import en, espeak
        british = voice.startswith('b')
        self.g2p_en = en.G2P(trf=False, british=british, fallback=espeak.EspeakFallback(british=british))

    def phonemes(self, text):
        ps, _ = self.g2p_en(text)
        return ps


def level(x, knee=0.6, ceiling=0.89):
    """The line at TARGET_RMS_DB over its speech (20 ms frames above -45 dBFS),
    the level of the film's own voices. Its few peaks are rounded off above
    the knee, never past -1 dBFS, rather than the whole line turned down for
    one consonant."""
    frames = x[: len(x) // 480 * 480].reshape(-1, 480)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    speech = rms[rms > 10 ** (-45 / 20)]
    y = x * 10 ** (TARGET_RMS_DB / 20) / max(1e-9, np.sqrt(np.mean(speech ** 2)))
    a = np.abs(y)
    over = a > knee
    y[over] = np.sign(y[over]) * (knee + (ceiling - knee) * np.tanh((a[over] - knee) / (ceiling - knee)))
    return y


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--model', required=True, help='Kokoro-82M v1.0 ONNX export (onnx/model.onnx)')
    ap.add_argument('--voices', required=True, help='folder holding af_heart.bin, bf_emma.bin, ...')
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--out', default=str(ROOT / 'audio' / 'voices' / 'narration' / 'en'))
    ap.add_argument('--js', default=str(ROOT / 'src' / 'narration.js'))
    args = ap.parse_args()

    for name, text in LINES.items():
        said = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text).lower()
        bad = [w for w in FORBIDDEN if w in said]
        if bad:
            raise SystemExit(f'{name}: says {bad}, which no film may say')

    tts = English(args.model, args.voices, args.voice)
    out = pathlib.Path(args.out)
    marks = {}
    for name, text in LINES.items():
        audio, _ = tts.speak(text, args.voice, args.speed)
        audio = level(audio)
        # Not voices.write_wav, which scales each line to its own peak: these
        # keep the one level they were given.
        out.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out / f'{name}.wav'), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
        marks[name] = round(len(audio) / SR, 3)
        print(f'{name:9s} {len(audio) / SR:5.2f}s  {text}')

    js = pathlib.Path(args.js)
    js.write_text(
        '// Written by tools/narration.py: the family film\'s English narration, each\n'
        '// line\'s length in seconds, and who says it. Regenerate rather than edit.\n'
        f'export const NARRATION = {json.dumps({"en": {"voice": args.voice, "speed": args.speed, "lines": marks}}, indent=2)};\n')
    print(js)


if __name__ == '__main__':
    main()
