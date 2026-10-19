// The family film's voice scene in each of the app's ten voice languages
// (src/lib/voice-languages.ts): what Maa asks, what the app answers, and the
// app's own phrases around them. The film shows one with ?lang= (render.mjs
// --lang, for the short cuts); without it, the full film's Hindi. Only the
// voice scene changes language: every headline stays in English.
//
// The app has its own phrases (the placeholder, Listening…, Cancel, Stop…) in
// English and Hindi only, and falls back to English (phrase() in
// voice-languages.ts), so every other language shows the English ones, as the
// app would. The answers write numbers in digits, as rag-search's answers do;
// what each voice is given to say, with the numbers as words, is in
// tools/voices_indic.py. These are first drafts: have someone who speaks each
// language read its lines before that version goes out.

export const APP_PHRASES = {
  en: {
    tap: 'Tap the microphone and ask', listening: 'Listening…', cancel: 'Cancel',
    thinking: 'Looking in your documents…', another: 'Tap to ask another question', again: 'Read again', stop: 'Stop',
    emptyTitle: 'Tap the microphone and ask about your documents', emptySub: 'For example: when does my passport expire?',
  },
  hi: {
    tap: 'माइक दबाएँ और पूछें', listening: 'सुन रहा हूँ…', cancel: 'रद्द करें',
    thinking: 'आपके दस्तावेज़ों में देख रहा हूँ…', another: 'दूसरा सवाल पूछने के लिए दबाएँ', again: 'फिर से सुनें', stop: 'रोकें',
    emptyTitle: 'माइक दबाएँ और अपने दस्तावेज़ों के बारे में पूछें', emptySub: 'जैसे: मेरा पासपोर्ट कब खत्म हो रहा है?',
  },
};

// q: the question as the recogniser writes it. lead, the policy number and
// tail: the answer's first sentence; a2: its second. app: whose phrases the
// screen shows. Maa calls her husband what a mother of that language would
// to her children's app: Papa, Baba, Appa, Nanna, Achan.
export const VOICE_LINES = {
  en: {
    name: 'English', app: 'en',
    q: "What's Papa's health insurance policy number?",
    lead: "Papa's health insurance policy number is", tail: '.',
    a2: "It's valid till 14 March 2027.",
  },
  hi: {
    name: 'Hindi', app: 'hi',
    q: 'पापा की हेल्थ इंश्योरेंस का पॉलिसी नंबर क्या है?',
    lead: 'पापा की हेल्थ इंश्योरेंस पॉलिसी का नंबर', tail: ' है।',
    a2: 'यह पॉलिसी 14 मार्च 2027 तक वैलिड है।',
  },
  bn: {
    name: 'Bengali', app: 'en',
    q: 'বাবার হেলথ ইনস্যুরেন্সের পলিসি নম্বরটা কী?',
    lead: 'বাবার হেলথ ইনস্যুরেন্স পলিসির নম্বর', tail: '।',
    a2: 'এই পলিসি 14 মার্চ 2027 পর্যন্ত ভ্যালিড।',
  },
  ta: {
    name: 'Tamil', app: 'en',
    q: 'அப்பாவோட ஹெல்த் இன்சூரன்ஸ் பாலிசி நம்பர் என்ன?',
    lead: 'அப்பாவோட ஹெல்த் இன்சூரன்ஸ் பாலிசி நம்பர்', tail: '.',
    a2: 'இந்த பாலிசி 14 மார்ச் 2027 வரை செல்லும்.',
  },
  te: {
    name: 'Telugu', app: 'en',
    q: 'నాన్న హెల్త్ ఇన్సూరెన్స్ పాలసీ నంబర్ ఏంటి?',
    lead: 'నాన్న హెల్త్ ఇన్సూరెన్స్ పాలసీ నంబర్', tail: '.',
    a2: 'ఈ పాలసీ 14 మార్చి 2027 వరకు చెల్లుతుంది.',
  },
  mr: {
    name: 'Marathi', app: 'en',
    q: 'बाबांच्या हेल्थ इन्शुरन्सचा पॉलिसी नंबर काय आहे?',
    lead: 'बाबांच्या हेल्थ इन्शुरन्स पॉलिसीचा नंबर', tail: ' आहे.',
    a2: 'ही पॉलिसी 14 मार्च 2027 पर्यंत वैध आहे.',
  },
  gu: {
    name: 'Gujarati', app: 'en',
    q: 'પપ્પાના હેલ્થ ઇન્શ્યોરન્સનો પોલિસી નંબર શું છે?',
    lead: 'પપ્પાના હેલ્થ ઇન્શ્યોરન્સ પોલિસીનો નંબર', tail: ' છે.',
    a2: 'આ પોલિસી 14 માર્ચ 2027 સુધી માન્ય છે.',
  },
  kn: {
    name: 'Kannada', app: 'en',
    q: 'ಅಪ್ಪನ ಹೆಲ್ತ್ ಇನ್ಶೂರೆನ್ಸ್ ಪಾಲಿಸಿ ನಂಬರ್ ಏನು?',
    lead: 'ಅಪ್ಪನ ಹೆಲ್ತ್ ಇನ್ಶೂರೆನ್ಸ್ ಪಾಲಿಸಿ ನಂಬರ್', tail: '.',
    a2: 'ಈ ಪಾಲಿಸಿ 14 ಮಾರ್ಚ್ 2027 ರವರೆಗೆ ಮಾನ್ಯವಾಗಿರುತ್ತದೆ.',
  },
  ml: {
    name: 'Malayalam', app: 'en',
    q: 'അച്ഛന്റെ ഹെൽത്ത് ഇൻഷുറൻസ് പോളിസി നമ്പർ എന്താ?',
    lead: 'അച്ഛന്റെ ഹെൽത്ത് ഇൻഷുറൻസ് പോളിസി നമ്പർ', tail: ' ആണ്.',
    a2: 'ഈ പോളിസിക്ക് 14 മാർച്ച് 2027 വരെ സാധുതയുണ്ട്.',
  },
  pa: {
    name: 'Punjabi', app: 'en',
    q: 'ਪਾਪਾ ਦੀ ਹੈਲਥ ਇੰਸ਼ੋਰੈਂਸ ਦਾ ਪਾਲਿਸੀ ਨੰਬਰ ਕੀ ਹੈ?',
    lead: 'ਪਾਪਾ ਦੀ ਹੈਲਥ ਇੰਸ਼ੋਰੈਂਸ ਪਾਲਿਸੀ ਦਾ ਨੰਬਰ', tail: ' ਹੈ।',
    a2: 'ਇਹ ਪਾਲਿਸੀ 14 ਮਾਰਚ 2027 ਤੱਕ ਵੈਲਿਡ ਹੈ।',
  },
};

// The English subtitles under the spoken lines. The English version has none:
// the phone already shows the same words.
export function voiceSubtitles(lang, policyNo) {
  return lang === 'en'
    ? null
    : { q: '“What is Papa\'s health insurance policy number?”', a1: `“It's ${policyNo}.”`, a2: '“The policy is valid till 14 March 2027.”' };
}
