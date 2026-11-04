#!/usr/bin/env python3
"""The fonts the films use in India's languages (?ui=, src/i18n.js).

Anek (Ek Type) sets the headlines and text, a grotesque like the films'
Bricolage Grotesque; Noto Serif sets the serif lines, which are italic in
English and upright here, since these scripts have no italics. One variable
woff2 per family and script goes into fonts/, and fonts/indic.css names them.
Latin keeps the films' own fonts: each family here is listed after them, and
only its script's range is downloaded. All are under the SIL Open Font
License.

usage: python3 tools/fonts_indic.py      (again to update them)
"""
import pathlib
import re
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / 'fonts'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

# family -> its weight range; each covers one script (Devanagari covers Hindi and Marathi).
FAMILIES = {
    'Anek Devanagari': '100..800', 'Anek Bangla': '100..800', 'Anek Tamil': '100..800',
    'Anek Telugu': '100..800', 'Anek Gujarati': '100..800', 'Anek Kannada': '100..800',
    'Anek Malayalam': '100..800', 'Anek Gurmukhi': '100..800',
    'Noto Serif Devanagari': '100..900', 'Noto Serif Bengali': '100..900', 'Noto Serif Tamil': '100..900',
    'Noto Serif Telugu': '100..900', 'Noto Serif Gujarati': '100..900', 'Noto Serif Kannada': '100..900',
    'Noto Serif Malayalam': '100..900', 'Noto Serif Gurmukhi': '100..900',
}
SCRIPTS = {'devanagari', 'bengali', 'tamil', 'telugu', 'gujarati', 'kannada', 'malayalam', 'gurmukhi'}


def fetch(url: str) -> bytes:
    return subprocess.run(['curl', '-sSfL', '-m', '60', '-A', UA, url], check=True, capture_output=True).stdout


def main() -> None:
    rules = ['/* Written by tools/fonts_indic.py: the films in India\'s languages (src/i18n.js). */']
    for family, axis in FAMILIES.items():
        q = urllib.parse.quote_plus(family)
        css = fetch(f'https://fonts.googleapis.com/css2?family={q}:wght@{axis}&display=block').decode()
        found = 0
        for script, body in re.findall(r'/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
            if script not in SCRIPTS:
                continue
            src = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
            weight = re.search(r'font-weight:\s*([0-9 ]+);', body).group(1).strip()
            ranges = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
            name = f"{family.lower().replace(' ', '')}-{script}.woff2"
            (FONTS / name).write_bytes(fetch(src))
            rules.append(f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n  font-weight: {weight};\n"
                         f"  font-display: block;\n  src: url({name}) format('woff2');\n  unicode-range: {ranges};\n}}")
            found += 1
        if not found:
            raise SystemExit(f'{family}: no subset for {sorted(SCRIPTS)} in Google Fonts\' answer')
        print(f'{family}: {found} file(s)')
    (FONTS / 'indic.css').write_text('\n'.join(rules) + '\n')
    print(f'wrote {FONTS / "indic.css"}')


if __name__ == '__main__':
    main()
