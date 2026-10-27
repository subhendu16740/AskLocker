// Offline self-test of the QA machinery itself — no network, no budget.
//
//   node tools/selftest.mjs
//
// Proves the answer matchers accept the forms real answers take (and reject
// near misses), that judgeAnswer() flags what it should, that the run-time
// vehicle PDF is read by the server's own layout code, that the server's
// metadata extraction and text cleaning behave (imported from
// supabase/functions/_shared/, not copied), and that questions.yaml is valid
// and each suite stays inside its Groq budget.
// CI runs it before any live check, so a broken matcher can never show up
// as a "failing app".

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { getDocument } from 'pdfjs-serverless';
import { reconstructLayout } from '../../supabase/functions/_shared/pdf-text.ts';
import { extractMetadata, parseFlexibleDate, gstinCheckChar, isValidGstin } from '../../supabase/functions/_shared/metadata.ts';
import { cleanText } from '../../supabase/functions/_shared/text.ts';
import { ticketCodeNotes, ticketSearchTerms } from '../../supabase/functions/_shared/tickets.ts';
import { digitsFromWords, restoreCodes } from '../../supabase/functions/_shared/numbers.ts';
import { takeInTurn, uniqueRelatives } from '../../supabase/functions/_shared/vaults.ts';
import { passagesUsed, splitUsedPassages } from '../../supabase/functions/_shared/used-passages.ts';
import { CLAUDE_MIN_MAX_TOKENS, claudeCanTake, claudeShouldRest, claudeText, claudeUsable, groqStyleReply, toClaudeRequest } from '../../supabase/functions/_shared/claude-shape.ts';
import { chooseEmbeddingProvider, cloudflareBody, cloudflareRetryable, embeddingModelId, runWithinBudget, truncateAndNormalise, CLOUDFLARE_DEFAULT_MODEL, EMBEDDING_DIMS, GTE_SMALL_MODEL_ID, HUGGINGFACE_MODEL, QUERY_INSTRUCTION, UNRECORDED_MODEL } from '../../supabase/functions/_shared/embedding-choice.ts';
import { toSpeech } from '../../src/lib/speech-text.ts';
import {
  BUILT_IN_CATEGORIES, BUSINESS_CATEGORIES, FAMILY_CATEGORIES, SUGGESTED_CATEGORIES, categoryOrder, countedCategory, suggestCategory,
} from '../../supabase/functions/_shared/doc-category.ts';
import { acceptedCurrencies, connectionCountry, hmacSha256Hex, payerCurrency, payerCurrencyMessage, paymentSignatureOk, plusOrderAmount, plusOrderDescription, sameText, webhookSignatureOk, ORDER_ID, PAYMENT_ID } from '../../supabase/functions/_shared/razorpay.ts';
import { createHmac } from 'node:crypto';
import {
  attachmentParts, classifyAttachment, allowedReturnOrigin, sniffType, storageFileName, senderDomain,
} from '../../supabase/functions/_shared/gmail-rules.ts';
import {
  importTokenKey, sealToken, openToken, pkceChallenge, sha256Hex, base64url, fromBase64,
} from '../../supabase/functions/_shared/gmail-crypto.ts';
import { buildGraph, relationTo, relationLabel, relativesForPrompt, relativesNamedIn, buildForest, shortName, siblingsSharingParents } from '../../supabase/functions/_shared/kinship.ts';
import { encryptPayload, vapidAuthorization, generateVapidKeys, isPushServiceEndpoint, MAX_PLAINTEXT } from '../../supabase/functions/_shared/webpush.ts';
import { phoneLooksRight, cardProblem, cardIsEmpty, emptyCard, bloodGroupLabel, bloodGroupSpoken, telHref } from '../../src/lib/emergency.ts';
import { allowanceJson, givenBack, parseAllowance, questionLimitMessage, questionsLeftText, resetDay } from '../../supabase/functions/_shared/questions.ts';
import { AGREEMENT_POINTS, AGREEMENT_VERSION, agreementText } from '../../supabase/functions/_shared/agreement.ts';
import { isSpreadsheetText, isSpreadsheetType, MAX_ROW_TOKENS, parseCsv, periodLabel, spreadsheetText } from '../../supabase/functions/_shared/spreadsheet-text.ts';
import { estimateTokens } from '../../supabase/functions/_shared/tokens.ts';
import { chunkText } from '../../supabase/functions/_shared/chunking.ts';
import { MAX_DOCUMENT_TEXT, MAX_FILE_BYTES, QUESTION_INPUT_MAX, MAX_QUESTION_CHARS, fileTooLargeMessage, inVaultFolder, limitHint, providedTextLimit } from '../../supabase/functions/_shared/limits.ts';
import { MAX_IMPORT_BYTES } from '../../supabase/functions/_shared/gmail-rules.ts';
import { BUSINESS_PLANS, BUSINESS_PRICE, BUSINESS_YEAR_PRICE, CLOSED_MESSAGE, plansHaveIndianLanguages, DEFAULT_PLAN_LIMITS, PLUS_FOR_SALE, PLUS_PRICE, PRO_PRICE, familyPlanName, isFamilyPlan, businessAmount, businessPrice, businessYearPrice, chatStorageFullMessage, fits, formatBytes, freeVaultsText, isBusinessPlan, nextBusinessPlan, personFits, personStorageFullMessage, planLabel, plusName, plusAmount, plusPrice, plusPrices, plusTwelveMonths, plusYearlyOffer, plusYearlySaving, storageFullMessage } from '../../supabase/functions/_shared/plan-text.ts';
import { mentionsDate, mentionsAmount, mentionsPhone, mentionsText, refuses, devanagariShare, scriptShare, hasMarkdown } from '../lib/match.mjs';
import { judgeAnswer } from '../lib/checks/ask.mjs';
import { EMBED_ALLOWANCE } from '../lib/results.mjs';
import { vehicleInsurance } from '../lib/tiny-pdf.mjs';
import { loadQuestions, selectQuestions, groupCount, rotationGroup, estimateFor } from '../lib/questions.mjs';
import { documents, permanentDocuments } from '../fixtures/documents.mjs';

let passed = 0;
const failures = [];
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; })
    .catch((err) => failures.push(`${name}: ${err.message}`));
}

await test('asking across vaults: each vault\'s best first, in turn (046)', () => {
  assert.deepEqual(takeInTurn([[1, 2, 3], ['a'], ['x', 'y']]), [1, 'a', 'x', 2, 'y', 3]);
  assert.deepEqual(takeInTurn([[], [1, 2]]), [1, 2]);
  assert.deepEqual(takeInTurn([]), []);
  // A family's long tax return cannot push a personal vault's one passage
  // out of the judge's fifteen places: it comes second, not sixteenth.
  const taxReturn = Array.from({ length: 40 }, (_, i) => `tax-${i}`);
  const merged = takeInTurn([taxReturn, ['passport']]);
  assert.equal(merged[1], 'passport');
  assert.equal(merged.length, 41);
});

await test('the same relative named in two vaults\' trees is one note (046)', () => {
  const said = (term, name) => ({ term, name, label: 'Mother', personId: `${name}-id` });
  const notes = uniqueRelatives([said('mom', 'Meena Rao'), said('mom', 'Meena Rao'), said('mom', 'Meena R.'), said('nani', 'Kamala Verma')]);
  assert.deepEqual(notes.map((n) => `${n.term}=${n.name}`), ['mom=Meena Rao', 'mom=Meena R.', 'nani=Kamala Verma']);
});

await test('dates in every common form', () => {
  for (const s of ['on 19/07/2033', 'on 19-07-2033', '19.7.2033', 'expires 19 July 2033.', '19th July, 2033', 'July 19, 2033', '2033-07-19', '19 जुलाई 2033 को', '१९/०७/२०३३']) {
    assert.ok(mentionsDate(s, '2033-07-19'), s);
  }
  for (const s of ['on 20/07/2033', 'July 2033', '19/07/2032', '119/07/2033', '19 / 07 / 2032']) assert.ok(!mentionsDate(s, '2033-07-19'), s);
  // Spaced separators, as the answer model copied them from the Hindi notice's
  // text layer: "The final deadline … is **30 / 11 / 2026**".
  for (const s of ['**30 / 11 / 2026**', '30 - 11 - 2026', '30. 11. 2026']) assert.ok(mentionsDate(s, '2026-11-30'), s);
  assert.ok(!mentionsDate('30 / 11 / 2025', '2026-11-30'));
});

await test('amounts with Indian grouping and lakh', () => {
  for (const s of ['₹3,00,000', 'Rs. 300000', 'INR 300,000', '3 lakh', '₹ 3.0 lakhs', '३,००,०००']) assert.ok(mentionsAmount(s, 300000), s);
  assert.ok(!mentionsAmount('₹10,00,000', 300000));
  assert.ok(mentionsAmount('₹10,00,000', 1000000));
  assert.ok(mentionsAmount('the rent is Rs. 32,000 a month', 32000));
  // Answers in other Indian languages may write their own digits.
  for (const [s, v] of [['মোট ২,৮৪৫ টাকা', 2845], ['₹ ૧,૧૦૩ ચૂકવ્યા', 1103], ['௫,௧௨௦ ரூபாய்', 5120], ['₹೭೫,೦೦೦', 75000], ['൧൨,൬൦൦ രൂപ', 12600], ['₹ ੪,੩੭੫', 4375], ['₹౧౮,౫౦౦', 18500]]) {
    assert.ok(mentionsAmount(s, v), s);
  }
  assert.ok(!mentionsAmount('₹ ૧,૧૪૫', 1103), 'another receipt\'s amount');
});

await test('phones, identifiers, refusals, script, markdown', () => {
  assert.ok(mentionsPhone('Her number is +91 98220 41937.', '9822041937'));
  assert.ok(!mentionsPhone('+91 90110 23452', '9822041937'));
  assert.ok(mentionsText('Passport no. z 739-1046', 'Z7391046'));
  assert.ok(mentionsText('declared: Hypothyroidism', 'hypothyroidism'));
  for (const s of ["I couldn't find anything in your documents that answers that.", 'None of your documents mention a chassis number.', 'The blood group is not mentioned in the documents.', 'There is no vehicle document in your vault.']) {
    assert.ok(refuses(s), s);
  }
  assert.ok(!refuses("Asha Verma's passport expires on 19 July 2033."));
  assert.ok(devanagariShare('आशा वर्मा का पासपोर्ट 19 जुलाई 2033 को समाप्त होगा।') > 0.9);
  assert.ok(devanagariShare('The passport expires in 2033.') === 0);
  assert.ok(scriptShare('সুমিতা ঘোষের বিদ্যুৎ বিলে মোট ২,৮৪৫ টাকা দিতে হবে।', 'bengali') > 0.9);
  assert.ok(scriptShare('மீனா சுப்பிரமணியம் ₹5,120 செலுத்த வேண்டும்.', 'tamil') > 0.9);
  assert.ok(scriptShare('மீனா சுப்பிரமணியம் ₹5,120 செலுத்த வேண்டும்.', 'malayalam') === 0, 'Tamil is not Malayalam');
  assert.ok(scriptShare('Meena Subramaniam has to pay ₹5,120.', 'tamil') === 0);
  assert.ok(hasMarkdown('**19 July 2033**') && hasMarkdown('- item') && !hasMarkdown('It expires on 19 July 2033.'));
});

const questions = loadQuestions(new URL('../questions.yaml', import.meta.url));
const byId = new Map(questions.map((q) => [q.id, q]));
const passport = [{ file_name: 'passport_asha_verma_specimen_v1.pdf' }];
const healthy = { embedded: true, models: { answer: 'openai/gpt-oss-120b' } };

await test('judgeAnswer accepts correct answers', () => {
  assert.deepEqual(judgeAnswer(byId.get('passport-expiry'), { answer: "Asha Verma's passport expires on 19 July 2033.", sources: passport, debug: healthy }), []);
  assert.deepEqual(judgeAnswer(byId.get('hindi-question'), { answer: 'आशा वर्मा का पासपोर्ट 19 जुलाई 2033 को समाप्त होगा।', sources: passport, answer_language: 'hi-IN', debug: healthy }), []);
  assert.deepEqual(judgeAnswer(byId.get('no-such-document'), { answer: "I couldn't find anything in your documents that answers that.", sources: [], debug: healthy }), []);
  assert.deepEqual(judgeAnswer(byId.get('policy-table-row'), { answer: 'The sum insured for Kamala Verma is ₹3,00,000.', sources: [{ file_name: 'health_policy_verma_specimen_v1.pdf' }], debug: healthy }), []);
});

await test('judgeAnswer catches wrong answers', () => {
  const wrongDate = judgeAnswer(byId.get('passport-expiry'), { answer: 'It expires on 20 July 2033.', sources: passport, debug: healthy });
  assert.ok(wrongDate.some((r) => r.includes('2033-07-19')));
  const invented = judgeAnswer(byId.get('no-such-document'), { answer: 'The chassis number is MA3EWDE1S00123456.', sources: [], debug: healthy });
  assert.equal(invented.length, 2);
  const otherRow = judgeAnswer(byId.get('policy-table-row'), { answer: 'Kamala Verma is covered for ₹10,00,000.', sources: [{ file_name: 'health_policy_verma_specimen_v1.pdf' }], debug: healthy });
  assert.equal(otherRow.length, 2);
  const fathers = judgeAnswer(byId.get('mobile-among-crowding-document'), { answer: 'Her mobile number is +91 90110 23452.', sources: [{ file_name: 'income_tax_return_rohan_ay2026_specimen_v1.pdf' }], debug: healthy });
  assert.equal(fathers.length, 3);
  const noVectors = judgeAnswer(byId.get('passport-expiry'), { answer: 'It expires on 19 July 2033.', sources: passport, debug: { embedded: false, embed_error: 'HTTP 410' } });
  assert.ok(noVectors.some((r) => r.includes('NOT embedded')));
  // HuggingFace out of credit is an outside allowance (inconclusive); a
  // retired host, a DNS failure or any other answer still fails.
  assert.ok(EMBED_ALLOWANCE.test('HTTP 402 (HuggingFace credit is used up): {"error":"You have exceeded your monthly included credits"}'));
  assert.ok(EMBED_ALLOWANCE.test('HTTP 429 (HuggingFace rate limit): slow down'));
  for (const other of ['HTTP 410: Gone', 'HTTP 401 (HuggingFace refused the token): bad', 'TypeError: error sending request: dns error: failed', 'HF_API_TOKEN is not set']) {
    assert.ok(!EMBED_ALLOWANCE.test(other), other);
  }
  const markdown = judgeAnswer(byId.get('voice-mode'), { answer: 'It expires on **19 July 2033**.', sources: passport, debug: healthy });
  assert.ok(markdown.some((r) => r.includes('markdown')));
});

await test('judgeAnswer in other Indian languages', () => {
  const bengali = [{ file_name: 'electricity_bill_bengali_specimen_v1.pdf' }];
  const tamilPhoto = [{ file_name: 'water_tax_receipt_tamil_photo_specimen_v1.jpg' }];
  assert.deepEqual(judgeAnswer(byId.get('lang-bengali-voice'), { answer: 'সুমিতা ঘোষের বিদ্যুৎ বিলে মোট ২,৮৪৫ টাকা দিতে হবে।', sources: bengali, answer_language: 'bn-IN', debug: healthy }), []);
  assert.deepEqual(judgeAnswer(byId.get('lang-tamil-photo-voice'), { answer: 'மீனா சுப்பிரமணியம் ₹5,120 குடிநீர் வரி செலுத்த வேண்டும்.', sources: tamilPhoto, answer_language: 'ta-IN', debug: healthy }), []);
  // The other Tamil bill's amount, for the wrong person.
  const other = judgeAnswer(byId.get('lang-tamil-photo-voice'), { answer: 'அவர் ₹6,480 செலுத்த வேண்டும்.', sources: [{ file_name: 'water_tax_receipt_tamil_specimen_v1.pdf' }], answer_language: 'ta-IN', debug: healthy });
  assert.equal(other.length, 3, other.join('; '));
  // Right amount, but in English: a Bengali speaker asked aloud.
  const english = judgeAnswer(byId.get('lang-bengali-voice'), { answer: 'Sumita Ghosh has to pay ₹2,845.', sources: bengali, answer_language: 'bn-IN', debug: healthy });
  assert.ok(english.some((r) => r.includes('Bengali script')), english.join('; '));
  // A typed question sends no language, so its answer's language is not judged.
  assert.deepEqual(judgeAnswer(byId.get('lang-tamil-typed'), { answer: 'Karthik Rajan has to pay ₹6,480.', sources: [{ file_name: 'water_tax_receipt_tamil_specimen_v1.pdf' }], debug: healthy }), []);
});

await test('the run-time vehicle PDF reads as a text layer with its facts', async () => {
  const v = vehicleInsurance({ today: new Date('2026-09-27T12:00:00Z'), runId: 'selftest' });
  assert.equal(v.expiry, '17/10/2026');
  const doc = await getDocument({ data: new Uint8Array(v.bytes), useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  const text = reconstructLayout(content.items.filter((i) => typeof i.str === 'string').map((i) => ({
    str: i.str, x: i.transform[4], y: i.transform[5], width: i.width ?? 0, height: Math.abs(i.transform[3]) || 10,
  })));
  assert.ok(text.length >= 200, `only ${text.length} characters — the server would treat it as a scan`);
  assert.ok(text.includes('Policy No: SMV2026990177'), 'policy number line');
  assert.ok(text.includes('Valid until: 17/10/2026'), 'expiry line');
  // What the live upload check then expects ingest to store.
  const meta = extractMetadata(text);
  assert.deepEqual(meta.filter((m) => m.key === 'expiry_date').map((m) => m.value), ['17/10/2026']);
  assert.ok(meta.some((m) => m.key === 'policy_number' && m.value === 'SMV2026990177'), 'policy number extracted');
});

await test('metadata: one expiry per date, never a truncated twin', () => {
  const expiries = (t) => extractMetadata(t).filter((m) => m.key === 'expiry_date').map((m) => m.value);
  // The YYYY-first pattern used to match these too, as "17/10/20".
  assert.deepEqual(expiries('Valid until: 17/10/2026'), ['17/10/2026']);
  assert.deepEqual(expiries('Date of Expiry: 19/07/2033'), ['19/07/2033']);
  assert.deepEqual(expiries('Expiry: 2033-07-19'), ['2033-07-19']);
  assert.deepEqual(expiries('valid thru 17.10.26'), ['17.10.26']);
  assert.deepEqual(expiries('Expiration: 2026-10-171'), [], 'a run of digits is not a date');
  assert.equal(parseFlexibleDate('17/10/2026'), '2026-10-17');
  assert.equal(parseFlexibleDate('2033-07-19'), '2033-07-19');
  assert.equal(parseFlexibleDate('19 July 2033'), '2033-07-19');
  assert.equal(parseFlexibleDate('17.10.26'), '2026-10-17');
});

await test('tickets: a seat question searches a ticket\'s words, and its codes are read out in words', () => {
  // A train ticket never says "seat": the berth is a code under Booking Status.
  assert.deepEqual(ticketSearchTerms('whats my seat number'), ['seat', 'berth', 'coach', 'status']);
  assert.deepEqual(ticketSearchTerms('Which coach and berth am I in?'), ['seat', 'berth', 'coach', 'status']);
  assert.deepEqual(ticketSearchTerms('What is the PNR of the Pune train?'), ['pnr']);
  assert.deepEqual(ticketSearchTerms('ticket number and seats'), ['seat', 'berth', 'coach', 'status', 'pnr']);
  for (const q of ['When does my passport expire?', 'research grant', 'Kamala\'s PAN']) assert.deepEqual(ticketSearchTerms(q), [], q);

  // SPECIMEN lines, laid out as the server reads an e-ticket: the same code
  // under Booking Status and Current Status is one note.
  const ticket = [
    'PNR No.  2400000001   Train No./Name  10001/SPECIMEN MAIL   Class  AC 3 TIER (3A)',
    'Quota  GENERAL (GN)   Distance  500 KM',
    'Booking Status  Current Status',
    'CNF/B4/17 UB  CNF/B4/17 UB',
  ].join('\n');
  assert.deepEqual(ticketCodeNotes([ticket]), ['CNF/B4/17 UB means confirmed: coach B4, berth 17, upper berth.']);
  assert.deepEqual(ticketCodeNotes(['CNF/B3/45/LOWER', 'CNF/S10/63/SIDE UPPER', 'CNF/C2/14/WS']), [
    'CNF/B3/45/LOWER means confirmed: coach B3, berth 45, lower berth.',
    'CNF/S10/63/SIDE UPPER means confirmed: coach S10, berth 63, side upper berth.',
    'CNF/C2/14/WS means confirmed: coach C2, berth 14, window seat.',
  ]);
  assert.deepEqual(ticketCodeNotes(['RAC/S4/45']), ['RAC/S4/45 means RAC, not yet a berth of their own (shared until confirmed): coach S4, berth 45.']);
  assert.deepEqual(ticketCodeNotes(['GNWL/25  WL 12  RAC 14']), [
    'GNWL/25 means waitlisted, number 25: no berth yet.',
    'WL 12 means waitlisted, number 12: no berth yet.',
    'RAC 14 means RAC number 14: a shared berth, not yet confirmed.',
  ]);
  assert.deepEqual(ticketCodeNotes(['Policy No. 2400000001, BOWL 12, MAIL 3, Quota GN, Class SL']), [], 'nothing that is not a status code');
  assert.equal(ticketCodeNotes(['WL 1 WL 2 WL 3 WL 4 WL 5 WL 6 WL 7 WL 8']).length, 6, 'at most six notes');
});

await test('numbers stay in digits on the screen, and are read out digit by digit from those digits', () => {
  // A model told to write for the ear once wrote a train number in words and
  // swapped two digits. Words go back to digits, in English and Hindi…
  assert.equal(digitsFromWords('Your train number is One six seven eight two.'), 'Your train number is 16782.');
  assert.equal(digitsFromWords('Call nine-eight-seven-six now'), 'Call 9876 now');
  assert.equal(digitsFromWords('Six, one, two, zero is the code'), '6120 is the code');
  assert.equal(digitsFromWords('ट्रेन नंबर एक छह सात आठ दो है।'), 'ट्रेन नंबर 16782 है।');
  assert.equal(digitsFromWords('PNR 4 5 1 2 6 7 is confirmed'), 'PNR 451267 is confirmed', 'single digits spaced apart join up');
  // …and ordinary words stay words.
  for (const plain of ['It takes one or two days.', 'two three days', 'Seats one, two and three', 'someone, everyone, no one two',
    'मुझे दो तीन दिन चाहिए', 'Pages 1 2 3 only', 'Aadhaar 1234 5678 9012', 'Policy SMV2026990177 and ₹3,00,000']) {
    assert.equal(digitsFromWords(plain), plain, plain);
  }
  const once = digitsFromWords('one two three four and 5 6 7 8');
  assert.equal(digitsFromWords(once), once, 'idempotent');

  // A code spelled out comes back exactly as the document writes it — letters too…
  const ticket = 'Train No./Name: 16782AB SPECIMEN EXPRESS  PAN: ABCD123456J  Vehicle: MH-12-AB-1234';
  const shown = (answer) => digitsFromWords(restoreCodes(answer, ticket));
  assert.equal(shown('Your train number is one six seven eight two A B.'), 'Your train number is 16782AB.');
  assert.equal(shown('Your train number is 16782 A B.'), 'Your train number is 16782AB.');
  assert.equal(shown('Your PAN is A B C D one two three four five six J.'), 'Your PAN is ABCD123456J.');
  assert.equal(shown('It is registered as M H 1 2 A B 1 2 3 4.'), 'It is registered as MH-12-AB-1234.');
  assert.equal(shown('The PAN is a A B C D 1 2 3 4 5 6 J'), 'The PAN is a ABCD123456J', 'a stray "a" before it stays a word');
  // …but only a code that is really there: digits out of order are not "corrected" into it.
  assert.equal(shown('Your train number is one six seven two eight A B.'), 'Your train number is 16728 A B.');
  // Codes already exact, amounts, seats and ordinary words are left alone.
  for (const plain of ['Your train number is 16782AB.', 'Your PAN is ABCD123456J.', 'Seats 23, 24 cost ₹ 1,100.',
    'Plan a 2 day trip', 'It takes one or two days.']) {
    assert.equal(shown(plain), plain, plain);
  }
  assert.equal(restoreCodes('one six seven eight two A B', ''), 'one six seven eight two A B', 'no passages, no change');

  // Read aloud: a number named as one is spelled out, by the app, from the digits.
  assert.equal(toSpeech('Your train number is 16782.'), 'Your train number is 1 6 7 8 2.');
  assert.equal(toSpeech('Train No. 16782 leaves at 5:40 from platform 3.'), 'Train No. 1 6 7 8 2 leaves at 5:40 from platform 3.');
  assert.equal(toSpeech('ट्रेन का नंबर 16782 है।'), 'ट्रेन का नंबर 1 6 7 8 2 है।');
  assert.equal(toSpeech('PIN code 751001'), 'PIN code 7 5 1 0 0 1');
  assert.equal(toSpeech('PNR 4512678901 is confirmed.'), 'PNR 4 5 1 2, 6 7 8 9, 0 1 is confirmed.', 'long numbers in groups of four');
  assert.equal(toSpeech('Your train number is 16782AB.'), 'Your train number is 1 6 7 8 2 A B.', 'a code letter by letter');
  assert.equal(toSpeech('Your PAN is ABCD123456J.'), 'Your PAN is A B C D, 1 2 3 4, 5 6 J.');
  // Seat and berth numbers, amounts and years are left to the voice.
  for (const plain of ['Seat number 17, coach B4, upper berth.', 'The fee is ₹18500.', 'It expires in 2027.', 'There is no 2027 renewal.']) {
    assert.equal(toSpeech(plain), plain, plain);
  }
});

await test('sources: only the passages the answer says it used', () => {
  // The answer ends with "USED: …"; the line is taken off and the chips come from it.
  const hotel = splitUsedPassages('आप होटल Luxe 8 Stayz में ठहरेंगे। बुकिंग आईडी NH90000000000000 है।\nUSED: 1');
  assert.equal(hotel.answer, 'आप होटल Luxe 8 Stayz में ठहरेंगे। बुकिंग आईडी NH90000000000000 है।');
  assert.deepEqual(hotel.used, [1]);
  assert.deepEqual(passagesUsed(['booking', 'bank statement'], hotel.used), ['booking'], 'the bank statement is not a source');
  // However the model writes it: same line, bold, "and", other scripts' digits, "none".
  assert.deepEqual(splitUsedPassages('Your hotel is Luxe 8 Stayz. USED: 2, 3'), { answer: 'Your hotel is Luxe 8 Stayz.', used: [2, 3] });
  assert.deepEqual(splitUsedPassages('Answer.\n**USED:** 1 and 3.').used, [1, 3]);
  assert.deepEqual(splitUsedPassages('Answer.\nUsed passages: 2').used, [2]);
  assert.deepEqual(splitUsedPassages('उत्तर।\nUSED: १ और ३'), { answer: 'उत्तर।', used: [1, 3] });
  assert.deepEqual(splitUsedPassages("I couldn't find that.\nUSED: none"), { answer: "I couldn't find that.", used: [] });
  assert.deepEqual(splitUsedPassages('Answer.\nUSED: 1\nNote: dates are in IST.'), { answer: 'Answer.\n\nNote: dates are in IST.', used: [1] });
  // No line: every passage sent stays a source, as before. Words are not the line.
  for (const plain of ['Just an answer.', 'This is the policy you used: the Harrier one.', 'Here is what I used:',
    'Used: 2019 Honda City, 40,000 km']) {
    assert.deepEqual(splitUsedPassages(plain), { answer: plain, used: null }, plain);
  }
  assert.deepEqual(passagesUsed(['a', 'b'], null), ['a', 'b']);
  assert.deepEqual(passagesUsed(['a', 'b'], []), [], 'none: no chips');
  assert.deepEqual(passagesUsed(['a', 'b', 'c'], [3, 1]), ['c', 'a']);
  assert.deepEqual(passagesUsed(['a', 'b'], [9]), ['a', 'b'], 'numbers that point nowhere say nothing');
  assert.deepEqual(passagesUsed(['a', 'b'], [2, 9]), ['b']);
});

await test('cleanText makes extracted text storable', () => {
  assert.equal(cleanText('आशा व\u0000मा'), 'आशा वमा', 'NUL removed, word kept whole');
  assert.equal(cleanText('a\uD800b\uDC00c'), 'abc', 'lone surrogates removed');
  assert.equal(cleanText('😀 ok'), '😀 ok', 'a real surrogate pair survives');
  assert.equal(cleanText('page 1\fpage 2'), 'page 1\npage 2');
  assert.equal(cleanText('tab\tnew\nline\r\n'), 'tab\tnew\nline\r\n');
  assert.equal(cleanText('bell\u0007!'), 'bell !');
});

await test('the Hindi PDF: the server reads NULs, and cleanText makes it storable', async () => {
  // PDF.js gives U+0000 for Devanagari glyphs it cannot map; Postgres refuses
  // a NUL in text/jsonb, and that failed the whole ingestion (HTTP 500).
  const hindi = documents.find((d) => d.file.startsWith('property_tax_notice_hindi'));
  const bytes = readFileSync(new URL(`../fixtures/files/${hindi.file}`, import.meta.url));
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  let text = '';
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    text += reconstructLayout(content.items.filter((i) => typeof i.str === 'string').map((i) => ({
      str: i.str, x: i.transform[4], y: i.transform[5], width: i.width ?? 0, height: Math.abs(i.transform[3]) || 10,
    })));
  }
  assert.ok(text.includes('\u0000'), 'no NUL in the raw text — the fixture no longer exercises the fix');
  const clean = cleanText(text);
  assert.ok(!JSON.stringify(clean).includes('\\u0000'), 'a NUL survived cleaning');
  for (const fact of hindi.facts) assert.ok(clean.replace(/\s+/g, ' ').includes(fact), `lost "${fact}"`);
});

await test('gmail: the attachments of a message, at any depth', () => {
  // A forwarded email: the PDF sits two levels down; a logo and a Word file do not count.
  const payload = {
    partId: '', mimeType: 'multipart/mixed', headers: [{ name: 'From', value: 'Asha <asha@example.com>' }],
    parts: [
      { partId: '0', mimeType: 'text/plain', filename: '', body: { size: 120 } },
      { partId: '1', mimeType: 'image/png', filename: 'image001.png', headers: [{ name: 'Content-ID', value: '<logo>' }], body: { size: 9000, attachmentId: 'A1' } },
      { partId: '2', mimeType: 'message/rfc822', filename: '', parts: [
        { partId: '2.0', mimeType: 'multipart/mixed', parts: [
          { partId: '2.0.1', mimeType: 'application/octet-stream', filename: 'Policy Schedule.PDF', body: { size: 245000, attachmentId: 'A2' } },
          { partId: '2.0.2', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'notes.docx', body: { size: 5000, attachmentId: 'A3' } },
        ] },
      ] },
    ],
  };
  const parts = attachmentParts(payload);
  assert.deepEqual(parts.map((p) => [p.partId, p.mimeType, p.inline]), [['1', 'image/png', true], ['2.0.1', 'application/pdf', false]]);
  assert.equal(parts[1].attachmentId, 'A2');
});

await test('gmail: suggest documents, drop email furniture, never read "company" as PAN', () => {
  const c = (fileName, extra = {}) => classifyAttachment({
    fileName, mimeType: /\.pdf$/i.test(fileName) ? 'application/pdf' : 'image/jpeg', size: 250_000, inline: false,
    from: 'Friend <friend@example.com>', subject: '', labelIds: ['INBOX'], ...extra,
  });
  assert.deepEqual(c('passport_scan.jpg'), { suggestion: 'suggested', reason: 'file name says passport', category: 'Passport' });
  assert.equal(c('Offer_Letter_Mira.pdf').suggestion, 'suggested', 'an offer LETTER is not marketing');
  assert.equal(c('Offer_Letter_Mira.pdf').category, 'Employment Letters');
  assert.equal(c('Sale_Deed_Flat402.pdf').category, 'Property Documents', 'a sale DEED is not marketing');
  assert.equal(c('Form16_FY2025-26.pdf').category, 'Tax Returns');
  assert.equal(c('e-Aadhaar.pdf').category, 'National ID / Aadhaar');
  assert.equal(c('aadhar card.jpg').category, 'National ID / Aadhaar', 'the common spelling');
  assert.equal(c('PAN_card.jpg').category, 'PAN Card');
  assert.equal(c('company_profile.pdf').category, null, '"company" does not contain the word PAN');
  assert.equal(c('company_profile.pdf').suggestion, 'maybe');
  // The subject is weaker evidence than the file name.
  assert.deepEqual(c('IMG_20260512_101010.jpg', { subject: 'Aadhaar card copy' }),
    { suggestion: 'maybe', reason: 'email is about Aadhaar', category: 'National ID / Aadhaar' });
  // A known issuer, and a lookalike of one.
  assert.equal(c('document.pdf', { from: 'HDFC Bank <alerts@hdfcbank.net>' }).suggestion, 'suggested');
  assert.equal(c('document.pdf', { from: 'HDFC Bank <alerts@hdfcbank.net>' }).category, 'Bank Statements');
  assert.equal(c('document.pdf', { from: 'HDFC <alerts@hdfcbank.net.example.com>' }).suggestion, 'maybe');
  assert.equal(senderDomain('"Passport Seva" <noreply@passportindia.gov.in>'), 'passportindia.gov.in');
  assert.equal(c('document.pdf', { from: 'noreply@passportindia.gov.in' }).reason, 'from a government (passportindia.gov.in)');
  // Marketing, and furniture.
  assert.equal(c('Diwali_Sale_Catalogue.pdf').suggestion, 'unlikely');
  assert.equal(c('brochure.pdf', { from: 'alerts@hdfcbank.net', subject: 'Exclusive offers for you' }).suggestion, 'unlikely');
  assert.equal(c('logo.png', { size: 8000, mimeType: 'image/png' }), null);
  assert.equal(c('image001.png', { size: 60_000, inline: true, mimeType: 'image/png' }), null);
  assert.equal(c('company-logo.jpg', { size: 90_000 }), null);
  assert.equal(c('passport.pdf', { size: 20 * 1024 * 1024 }).suggestion, 'unlikely', 'too big to import');
  assert.equal(c('passport.pdf', { labelIds: ['CATEGORY_PROMOTIONS'] }).suggestion, 'unlikely');
});

await test('gmail: Google\'s answer returns only to an allowed origin', () => {
  const dev = 'https://family-vault-git-dev-subhendu16740.vercel.app';
  assert.equal(allowedReturnOrigin(dev, `${dev}/`), dev, 'a trailing slash in the secret is fine');
  assert.equal(allowedReturnOrigin(`${dev}/gmail-import?x=1`, dev), dev, 'only the origin is kept');
  assert.equal(allowedReturnOrigin('https://family-vault-cyan.vercel.app', dev), null, 'not listed');
  assert.equal(allowedReturnOrigin('https://family-vault-cyan.vercel.app', ` ${dev} , https://family-vault-cyan.vercel.app`), 'https://family-vault-cyan.vercel.app');
  const pattern = 'https://family-vault-*-subhendu16740.vercel.app';
  assert.equal(allowedReturnOrigin('https://family-vault-dbmzqbq0v-subhendu16740.vercel.app', pattern), 'https://family-vault-dbmzqbq0v-subhendu16740.vercel.app');
  assert.equal(allowedReturnOrigin('https://family-vault-a.evil.com-subhendu16740.vercel.app', pattern), null, '* never spans a dot');
  assert.equal(allowedReturnOrigin('https://evil.example/family-vault-x-subhendu16740.vercel.app', pattern), null);
  // Cloudflare Pages: every branch and build is one label under the project's own address.
  const pages = 'https://*.asklocker.pages.dev';
  assert.equal(allowedReturnOrigin('https://dev.asklocker.pages.dev', pages), 'https://dev.asklocker.pages.dev');
  assert.equal(allowedReturnOrigin('https://3f1c2a9b.asklocker.pages.dev', pages), 'https://3f1c2a9b.asklocker.pages.dev');
  assert.equal(allowedReturnOrigin('https://evil.pages.dev', pages), null, 'another project is not ours');
  assert.equal(allowedReturnOrigin('https://a.evil.asklocker.pages.dev', pages), null, '* never spans a dot');
  assert.equal(allowedReturnOrigin('http://localhost:8081', ''), 'http://localhost:8081', 'local development needs no configuration');
  assert.equal(allowedReturnOrigin('http://evil.example', 'http://evil.example'), null, 'plain http only for localhost');
  assert.equal(allowedReturnOrigin(`https://user:pw@${dev.slice(8)}`, dev), null, 'no credentials');
  assert.equal(allowedReturnOrigin('javascript:alert(1)', dev), null);
  assert.equal(allowedReturnOrigin(undefined, dev), null);
});

await test('gmail: stored files are what their bytes say, under a safe name', () => {
  const bytes = (...b) => new Uint8Array(b);
  assert.equal(sniffType(new TextEncoder().encode('%PDF-1.7\n...')), 'pdf');
  assert.equal(sniffType(new TextEncoder().encode('\r\n  junk %PDF-1.4')), 'pdf', 'a little junk before %PDF- is allowed');
  assert.equal(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpg');
  assert.equal(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
  assert.equal(sniffType(new TextEncoder().encode('PK\u0003\u0004 a zip named .pdf')), null);
  assert.equal(storageFileName('My Passport (2024).PDF', 'pdf'), 'My_Passport_2024.pdf');
  assert.equal(storageFileName('scan.pdf', 'jpg'), 'scan.jpg', 'the bytes decide the extension');
  assert.equal(storageFileName('पासपोर्ट.pdf', 'pdf'), 'document.pdf');
  assert.equal(storageFileName('../../etc/passwd.jpg', 'jpg'), 'etc_passwd.jpg', 'no path survives');
});

await test('gmail: refresh tokens are sealed, and PKCE matches RFC 7636', async () => {
  const key = await importTokenKey(base64url(crypto.getRandomValues(new Uint8Array(32))));
  const sealed = await sealToken(key, '1//refresh-token-value');
  assert.ok(sealed.startsWith('v1.') && !sealed.includes('refresh-token-value'));
  assert.equal(await openToken(key, sealed), '1//refresh-token-value');
  assert.notEqual(await sealToken(key, 'same'), await sealToken(key, 'same'), 'a fresh IV every time');
  const [v, iv, data] = sealed.split('.');
  // Change the second-to-last character (the last may hold only padding bits).
  const flipped = `${v}.${iv}.${data.slice(0, -2)}${data.at(-2) === 'A' ? 'B' : 'A'}${data.slice(-1)}`;
  await assert.rejects(openToken(key, flipped), 'a tampered token must not open');
  const other = await importTokenKey(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'));
  await assert.rejects(openToken(other, sealed), 'another key must not open it');
  await assert.rejects(importTokenKey('c2hvcnQ='), /32 random bytes/);
  assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.deepEqual([...fromBase64(base64url(new Uint8Array([251, 255, 0, 1])))], [251, 255, 0, 1]);
});

// A fictional family, three generations on both sides (SPECIMEN names).
const kin = (() => {
  const P = (id, name, gender, birthDate) => ({ id, name, gender, birthDate });
  const people = [
    P('ramesh', 'Ramesh Verma', 'male', '1945-01-01'), P('kamala', 'Kamala Verma', 'female', '1948-01-01'),
    P('suresh', 'Suresh Rao', 'male', '1950-01-01'), P('meena', 'Meena Rao', 'female', '1952-01-01'),
    P('vinod', 'Vinod Verma', 'male', '1970-01-01'), P('sunita', 'Sunita Verma', 'female', '1972-01-01'),
    P('rohan', 'Rohan Verma', 'male', '1975-01-01'), P('priya', 'Priya Singh', 'female', '1978-01-01'),
    P('vikram', 'Vikram Singh', 'male', '1976-01-01'),
    P('asha', 'Asha Verma', 'female', '1977-01-01'), P('anil', 'Anil Rao', 'male', '1980-01-01'),
    P('neha', 'Neha Rao', 'female', '1982-01-01'), P('kavita', 'Kavita Iyer', 'female', '1983-01-01'),
    P('manoj', 'Manoj Iyer', 'male', '1981-01-01'),
    P('aarav', 'Aarav Verma', 'male', '2005-01-01'), P('diya', 'Diya Verma', 'female', '2008-01-01'),
    P('kunal', 'Kunal Verma', 'male', '2000-01-01'), P('kabir', 'Kabir Singh', 'male', '2010-01-01'),
    P('riya', 'Riya Verma', 'female', '2006-01-01'), P('ishaan', 'Ishaan Verma', 'male', '2026-01-01'),
    P('guest', 'A Guest', null, null),
  ];
  const par = (from, ...tos) => tos.map((to) => ({ from, to, kind: 'parent' }));
  const sp = (a, b) => ({ from: a, to: b, kind: 'spouse' });
  const links = [
    sp('ramesh', 'kamala'), sp('suresh', 'meena'), sp('vinod', 'sunita'), sp('rohan', 'asha'),
    sp('priya', 'vikram'), sp('anil', 'neha'), sp('kavita', 'manoj'), sp('aarav', 'riya'),
    ...par('ramesh', 'vinod', 'rohan', 'priya'), ...par('kamala', 'vinod', 'rohan', 'priya'),
    ...par('suresh', 'asha', 'anil', 'kavita'), ...par('meena', 'asha', 'anil', 'kavita'),
    ...par('rohan', 'aarav', 'diya'), ...par('asha', 'aarav', 'diya'),
    ...par('vinod', 'kunal'), ...par('sunita', 'kunal'), ...par('priya', 'kabir'), ...par('vikram', 'kabir'),
    ...par('aarav', 'ishaan'), ...par('riya', 'ishaan'),
  ];
  return buildGraph(people, links);
})();
// The relation and its Hindi term, both still worked out: the term is what Ask
// understands ("Nani's pension"). The screens show only the English (045).
const said = (me, other) => {
  const rel = relationTo(kin, me, other);
  return rel ? `${rel.en}${rel.hi ? ` (${rel.hi})` : ''}` : null;
};

await test('kinship: parents, grandparents, aunts and uncles on each side', () => {
  const expected = {
    rohan: 'Father (Papa)', asha: 'Mother (Maa)', diya: 'Sister (Behen)',
    ramesh: 'Grandfather (Dada)', kamala: 'Grandmother (Dadi)', suresh: 'Grandfather (Nana)', meena: 'Grandmother (Nani)',
    vinod: 'Uncle (Tau)', priya: 'Aunt (Bua)', anil: 'Uncle (Mama)', kavita: 'Aunt (Mausi)',
    sunita: 'Aunt (Tai)', vikram: 'Uncle (Phupha)', neha: 'Aunt (Mami)', manoj: 'Uncle (Mausa)',
    kunal: 'Cousin', kabir: 'Cousin', riya: 'Wife (Patni)', ishaan: 'Son (Beta)',
  };
  for (const [who, label] of Object.entries(expected)) assert.equal(said('aarav', who), label, `Aarav → ${who}`);
  assert.equal(said('diya', 'aarav'), 'Brother (Bhaiya)', 'an elder brother');
  assert.equal(relationTo(kin, 'aarav', 'guest'), null, 'not connected');
  assert.equal(relationTo(kin, 'aarav', 'aarav').en, 'You');
});

await test('kinship: in-laws and the next generation, named from each side', () => {
  const cases = [
    ['asha', 'rohan', 'Husband (Pati)'], ['asha', 'ramesh', 'Father-in-law (Sasur)'], ['asha', 'kamala', 'Mother-in-law (Saas)'],
    ['asha', 'priya', 'Sister-in-law (Nanad)'], ['asha', 'vinod', 'Brother-in-law (Jeth)'], ['asha', 'riya', 'Daughter-in-law (Bahu)'],
    ['asha', 'ishaan', 'Grandson (Pota)'], ['asha', 'anil', 'Brother (Bhai)'], ['asha', 'neha', 'Sister-in-law (Bhabhi)'],
    ['asha', 'manoj', 'Brother-in-law (Jija)'], ['rohan', 'anil', 'Brother-in-law (Saala)'], ['rohan', 'kavita', 'Sister-in-law (Saali)'],
    ['ramesh', 'aarav', 'Grandson (Pota)'], ['ramesh', 'kabir', 'Grandson (Nati)'], ['priya', 'aarav', 'Nephew (Bhatija)'],
    ['priya', 'diya', 'Niece (Bhatiji)'], ['anil', 'aarav', 'Nephew (Bhanja)'], ['ramesh', 'ishaan', 'Great-grandson'],
    ['ishaan', 'ramesh', 'Great-grandfather (Pardada)'], ['ishaan', 'meena', 'Great-grandmother'],
  ];
  for (const [me, other, label] of cases) assert.equal(said(me, other), label, `${me} → ${other}`);
});

await test('kinship: the family as rag-search hands it to the model', () => {
  const lines = relativesForPrompt(kin, 'aarav');
  assert.ok(lines.includes('Aarav Verma: you'));
  assert.ok(lines.includes('Meena Rao: your grandmother (Nani)'));
  assert.ok(lines.includes('Asha Verma: your mother (Maa)'));
  assert.ok(lines.includes('A Guest'), 'unconnected people keep their name');
  assert.ok(relativesForPrompt(kin, null).every((l) => !l.includes('your')), 'no viewer, no relations');
});

await test('kinship: relations named in a question become names, with no model call', () => {
  const named = (me, ...texts) => relativesNamedIn(kin, me, ...texts).map((r) => `${r.term}=${r.name}`).sort();
  assert.deepEqual(named('aarav', "When does Nani's pension renew?"), ['nani=Meena Rao']);
  assert.deepEqual(named('aarav', 'Mummy ka passport kab expire hoga'), ['mummy=Asha Verma']);
  assert.deepEqual(named('aarav', 'my dad and my mom'), ['dad=Rohan Verma', 'mom=Asha Verma']);
  assert.deepEqual(named('aarav', 'Buaji ka Aadhaar'), ['buaji=Priya Singh']);
  assert.deepEqual(named('aarav', 'नानी की पेंशन कब आएगी'), ['नानी=Meena Rao'], 'Hindi in Devanagari');
  assert.deepEqual(named('aarav', 'my grandmother'), ['grandmother=Kamala Verma', 'grandmother=Meena Rao'], 'both grandmothers: the answer sorts it out');
  assert.deepEqual(named('aarav', "Mama's car insurance"), ['mama=Anil Rao'], "Mama is Maa's brother, never Maa");
  assert.deepEqual(named('asha', "my mother-in-law's PAN"), ['mother in law=Kamala Verma'], 'mother-in-law is not also mother');
  assert.deepEqual(named('asha', 'Saasu maa'), ['maa=Meena Rao'], 'Maa is still her own mother');
  assert.deepEqual(named('aarav', 'my MA degree certificate', 'the person who signed'), [], 'no MA, no "son" inside "person"');
  assert.deepEqual(named('aarav', 'the house papers'), []);
  assert.deepEqual(named(null, "Nani's pension"), [], 'no place in the tree, nothing to resolve');
  assert.deepEqual(named('guest', "Nani's pension"), [], 'connected to nobody');
  // No gender recorded: "mother" can only mean one of the parents.
  const plain = buildGraph([{ id: 'k', name: 'Kid', gender: null }, { id: 'p', name: 'Pat Rao', gender: null }],
    [{ from: 'p', to: 'k', kind: 'parent' }]);
  assert.deepEqual(relativesNamedIn(plain, 'k', "my mother's passport").map((r) => r.name), ['Pat Rao']);
});

await test('kinship: the family\'s nickname names its person, on screen and in a question (045)', () => {
  const g = buildGraph([
    { id: 'me', name: 'Aarav Verma', gender: 'male' },
    { id: 'dad', name: 'Rohan Verma', gender: 'male' },
    { id: 'mom', name: 'Asha Verma', gender: 'female', nickname: 'Mummy Ji' },
    { id: 'sis', name: 'Priya Singh', gender: 'female', nickname: 'Pinky' },
    { id: 'friend', name: 'Ravi Kumar', gender: 'male', nickname: 'Bablu' },
    { id: 'short', name: 'Om Das', gender: 'male', nickname: 'Om' },
  ], [
    { from: 'dad', to: 'me', kind: 'parent' }, { from: 'mom', to: 'me', kind: 'parent' },
    { from: 'dad', to: 'sis', kind: 'parent' }, { from: 'mom', to: 'sis', kind: 'parent' },
    { from: 'dad', to: 'mom', kind: 'spouse' },
  ]);
  const named = (...texts) => relativesNamedIn(g, 'me', ...texts).map((r) => `${r.term}=${r.name}:${r.label}`).sort();
  assert.deepEqual(named("When does Pinky's passport expire?"), ['pinky=Priya Singh:Sister']);
  assert.deepEqual(named('Bablu ka PAN'), ['bablu=Ravi Kumar:family member'], 'named by nickname, with no relation to the asker');
  assert.deepEqual(named("Mummy Ji's Aadhaar"), ['mummy ji=Asha Verma:Mother'], 'a nickname of two words, longest first');
  assert.deepEqual(named('Om Shanti Om'), [], 'a nickname of two letters names nobody');
  assert.equal(relationLabel(relationTo(g, 'me', 'sis')), 'Sister', 'the screen shows the relation, and the nickname beside it');
  const prompt = relativesForPrompt(g, 'me');
  assert.ok(prompt.some((l) => l.startsWith('Priya Singh (called "Pinky"): your sister')), prompt.join(' | '));
  assert.ok(prompt.includes('Ravi Kumar (called "Bablu")'), prompt.join(' | '));
});

await test('kinship: the tree starts from each pair of ancestors, the viewer\'s own first', () => {
  const forest = buildForest(kin, 'aarav');
  assert.deepEqual(forest.branches.map((b) => b.title), ['Ramesh & Kamala', 'Suresh & Meena']);
  assert.equal(forest.first, 0);
  assert.equal(buildForest(kin, 'anil').first, 1, "Anil descends from Suresh & Meena");
  assert.equal(buildForest(kin, 'vikram').first, 0, 'married in: shown with his wife\'s family');
  const verma = forest.branches[0].roots[0];
  assert.deepEqual(verma.children.map((c) => c.person.name), ['Vinod Verma', 'Rohan Verma', 'Priya Singh'], 'eldest first');
  const rohan = verma.children[1];
  assert.deepEqual(rohan.spouses.map((s) => s.name), ['Asha Verma']);
  assert.deepEqual(rohan.children.map((c) => c.person.name), ['Aarav Verma', 'Diya Verma']);
  assert.deepEqual(forest.loose.map((p) => p.name), ['A Guest']);
  // A loop in bad data must not hang the screen.
  const loop = buildGraph([{ id: 'x', name: 'X', gender: null }, { id: 'y', name: 'Y', gender: null }],
    [{ from: 'x', to: 'y', kind: 'parent' }, { from: 'y', to: 'x', kind: 'parent' }]);
  assert.ok(buildForest(loop, 'x'));
});

await test('kinship: a sister added before Papa is drawn beside her brother, under Papa', () => {
  // As a family really builds it: "Shatabdi is Subhendu's sister" first, then
  // "K C Das Mohapatra is Subhendu's father". Nobody said she is his daughter.
  const P = (id, name, gender) => ({ id, name, gender });
  const g = buildGraph(
    [P('papa', 'K C Das Mohapatra', 'male'), P('me', 'Subhendu', 'male'), P('sis', 'Shatabdi', 'female')],
    [{ from: 'sis', to: 'me', kind: 'sibling' }, { from: 'papa', to: 'me', kind: 'parent' }],
  );
  const forest = buildForest(g, 'me');
  assert.deepEqual(forest.branches.map((b) => b.title), ['K C Das Mohapatra'], 'one branch, named in full: "K" says nothing');
  assert.deepEqual(forest.branches[0].roots[0].children.map((c) => c.person.name).sort(), ['Shatabdi', 'Subhendu']);
  assert.deepEqual(forest.loose, []);
  assert.equal(relationTo(g, 'me', 'sis').hi, 'Behen');
  assert.equal(relationLabel(relationTo(g, 'me', 'sis')), 'Sister', 'the screens show the English relation alone');
  // Adding Maa now reaches her too, with the Papa she was missing.
  assert.deepEqual(siblingsSharingParents(g, 'me'), [{ id: 'sis', missing: ['papa'] }]);
  // A half-brother with a different mother recorded is left alone.
  const half = buildGraph(
    [P('papa', 'Papa', 'male'), P('me', 'Me', null), P('bro', 'Bro', 'male'), P('other', 'Other Mother', 'female')],
    [{ from: 'bro', to: 'me', kind: 'sibling' }, { from: 'papa', to: 'me', kind: 'parent' }, { from: 'other', to: 'bro', kind: 'parent' }],
  );
  assert.deepEqual(siblingsSharingParents(half, 'me'), []);
  assert.equal(shortName('K C Das Mohapatra'), 'K C Das Mohapatra');
  assert.equal(shortName('Dr. Meena Rao'), 'Meena');
  assert.equal(shortName('Ramesh Verma'), 'Ramesh');
});

await test('emergency card: the form checks what save_emergency_card() checks (032)', () => {
  for (const ok of ['+91 98765 43210', '(011) 2345-6789', '112', '9876543210', '+44 20 7946 0958']) assert.ok(phoneLooksRight(ok), ok);
  for (const bad of ['call me', '12', '+', '98765 ext 5', '1234567890123456', '']) assert.ok(!phoneLooksRight(bad), bad);
  const wrongPhone = "doesn't look right. Use digits, like +91 98765 43210.";
  assert.equal(cardProblem({ ...emptyCard(), doctorPhone: 'call me' }), `The doctor's phone number ${wrongPhone}`);
  assert.equal(cardProblem({ ...emptyCard(), contacts: [{ name: 'Asha', relation: null, phone: 'call' }] }), `Asha's phone number ${wrongPhone}`);
  assert.equal(cardProblem({ ...emptyCard(), contacts: [{ name: 'Rohan', relation: 'Son', phone: '' }] }),
    'Each person to call needs a name and a phone number.');
  const four = ['111', '112', '113', '114'].map((phone, i) => ({ name: `P${i}`, relation: null, phone }));
  assert.equal(cardProblem({ ...emptyCard(), contacts: four }), 'Add at most three people to call.');
  // An empty row on the form is not a contact, and a card of empty rows is empty.
  const blankRow = { ...emptyCard(), allergies: '  ', contacts: [{ name: ' ', relation: '', phone: '' }] };
  assert.equal(cardProblem(blankRow), null);
  assert.ok(cardIsEmpty(blankRow));
  assert.ok(!cardIsEmpty({ ...emptyCard(), bloodGroup: 'O+' }));
  assert.equal(bloodGroupLabel('A-'), 'A−');
  assert.equal(bloodGroupLabel('hh'), 'Bombay (hh)');
  assert.equal(bloodGroupLabel(null), 'Not known');
  assert.equal(bloodGroupSpoken('AB+'), 'AB positive');
  assert.equal(telHref('+91 98765-43210'), 'tel:+919876543210');
});

await test('web push: encryption matches RFC 8291\'s example, byte for byte', async () => {
  // RFC 8291 section 5 and appendix A: "When I grow up, I want to be a watermelon".
  const target = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
  const fixed = {
    salt: fromBase64('DGv6ra1nlYgDCS1FRnbzlw'),
    publicKey: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  };
  const message = await encryptPayload(fromBase64('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), target, fixed);
  const header = fromBase64('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const ciphertext = fromBase64('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ');
  assert.equal(base64url(message), base64url(new Uint8Array([...header, ...ciphertext])));
  // A real message: a fresh salt and key every time, never the same bytes twice.
  const plain = new TextEncoder().encode('{"title":"Passport expires in 30 days"}');
  assert.notEqual(base64url(await encryptPayload(plain, target)), base64url(await encryptPayload(plain, target)));
  await assert.rejects(encryptPayload(new Uint8Array(MAX_PLAINTEXT + 1), target), /at most/);
  await assert.rejects(encryptPayload(plain, { ...target, auth: 'c2hvcnQ' }), /16 bytes/);
});

await test('web push: VAPID signs for the push service, and only push services are posted to', async () => {
  const keys = await generateVapidKeys();
  assert.equal(fromBase64(keys.publicKey).length, 65);
  const auth = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { ...keys, subject: 'https://example.org' }, 1_900_000_000);
  const [, token, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
  assert.equal(k, keys.publicKey);
  const [h, c, sig] = token.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromBase64(c))), { aud: 'https://fcm.googleapis.com', exp: 1_900_000_000, sub: 'https://example.org' });
  const pub = await crypto.subtle.importKey('raw', fromBase64(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromBase64(sig), new TextEncoder().encode(`${h}.${c}`)), 'the signature verifies');
  for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/Q', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
    assert.ok(isPushServiceEndpoint(ok), ok);
  }
  for (const bad of ['https://evil.example/fcm.googleapis.com', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:8443/x', 'not a url']) {
    assert.ok(!isPushServiceEndpoint(bad), bad);
  }
});

await test('questions.yaml is consistent with the fixtures', () => {
  const files = new Set(permanentDocuments.map((d) => d.file));
  for (const q of questions) if (q.expect.source) assert.ok(files.has(q.expect.source), `${q.id} cites ${q.expect.source}, which is not a permanent fixture`);
  assert.equal(documents.filter((d) => d.kind === 'locked-pdf').length, 1, 'exactly one locked fixture');
});

await test('every suite stays inside its Groq budget', () => {
  const groups = groupCount(questions);
  assert.equal(selectQuestions(questions, 'smoke', 1).length, 3);
  assert.equal(selectQuestions(questions, 'no-questions', 1).length, 0);
  for (let g = 1; g <= groups; g++) {
    const nightly = selectQuestions(questions, 'nightly', g);
    assert.ok(nightly.length <= 10, `nightly group ${g} asks ${nightly.length}`);
    assert.ok(estimateFor(nightly).helperShare <= 0.4, `nightly group ${g} would spend ${Math.round(estimateFor(nightly).helperShare * 100)}% of the helper model's day`);
    for (const q of nightly) if (q.after) assert.ok(nightly.some((p) => p.id === q.after), `${q.id} follows ${q.after}, not in the same run`);
  }
  // Two post-deploy runs plus the nightly: the most QA spends in one day.
  const worst = 2 * estimateFor(selectQuestions(questions, 'smoke', 1)).helperShare
    + Math.max(...Array.from({ length: groups }, (_, i) => estimateFor(selectQuestions(questions, 'nightly', i + 1)).helperShare));
  assert.ok(worst <= 0.6, `worst day would spend ${Math.round(worst * 100)}% of the helper model's free allowance`);
  const seen = new Set(Array.from({ length: groups }, (_, i) => rotationGroup(new Date(Date.UTC(2026, 8, 27 + i)), groups)));
  assert.equal(seen.size, groups, 'consecutive days cover every rotation group');
});

await test('plans: every limit is finite, and a full vault says why and what to do (038–048)', () => {
  const GB = 1024 ** 3, MB = 1024 ** 2;
  // What 039–067 leave in plan_limits: one row per plan; on Free 100 MB for
  // each person to add across their free vaults (060, 067), a family vault
  // 200 MB, a personal vault 100 MB and a business 200 MB; Plus 5 GB and Pro
  // 10 GB (067); 30 days after a paid plan ends before anything above Free
  // goes; 2 members on Free, 4 on Plus and 8 on Pro (064); voice with no
  // limit on any plan (066); 20 questions a month for each person on Free,
  // and a month shared by the vault on every paid plan (066, 067): Plus 250,
  // Pro 500, Business Plus 1,000, Pro 2,000 and Enterprise 8,000. A business
  // (051) has its own plans: 20, 50 and 200 GB (067). On Free a person
  // creates one family and one business (059), and Family Plus adds 100
  // documents and 20 question tries a day (067).
  assert.deepEqual(DEFAULT_PLAN_LIMITS, {
    free: 200 * MB, freePersonal: 100 * MB, freeBusiness: 200 * MB, freePerson: 100 * MB, plus: 5 * GB, graceDays: 30,
    familyPro: { storage: 10 * GB, members: 8, questions: 500 },
    members: { free: 2, plus: 4 },
    freeBusinessMembers: 2,
    voiceAnswers: { free: null, plus: null },
    questions: { free: 20, plus: null },
    questionsFairUse: 250,
    familyQuestions: 250,
    questionTriesPerDay: { free: 10, plus: 20 },
    uploadsPerDay: { free: 50, plus: 100 },
    familiesPerPerson: 1,
    businessesPerPerson: 1,
    vaultsPerPerson: null,
    notesPerPerson: { free: 20, paid: 500 },
    invitesPerDay: { free: 20, plus: 20 },
    business: {
      business_plus: { storage: 20 * GB, members: 5, questions: 1000, questionsShared: true, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 20 },
      business_pro: { storage: 50 * GB, members: 10, questions: 2000, questionsShared: true, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 20 },
      business_enterprise: { storage: 200 * GB, members: 50, questions: 8000, questionsShared: true, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 50 },
    },
  });
  // The owner's prices, 25 October 2026 (066): ₹99 / ₹999 and $10 / $99 for
  // Plus, ₹199 / ₹1,999 and $20 / $199 for Pro.
  assert.deepEqual(PLUS_PRICE, { monthly: { inr: 99, usd: 10 }, yearly: { inr: 999, usd: 99 } });
  assert.deepEqual(PRO_PRICE, { monthly: { inr: 199, usd: 20 }, yearly: { inr: 1999, usd: 199 } });
  // A year must cost less than twelve months, and stay under ₹2,000, above
  // which UPI charges merchants 0.4%.
  for (const price of [PLUS_PRICE, PRO_PRICE]) {
    for (const c of ['inr', 'usd']) assert.ok(price.yearly[c] < 12 * price.monthly[c], `${c}: a year costs less than twelve months`);
    assert.ok(price.yearly.inr < 2000, 'a year stays under ₹2,000');
  }
  // apply_plan_payment() (064) keeps the time left when moving between Plus
  // and Pro at Pro costing twice Plus a month; ₹199 is close enough to twice ₹99.
  for (const c of ['inr', 'usd']) {
    const ratio = PRO_PRICE.monthly[c] / PLUS_PRICE.monthly[c];
    assert.ok(Math.abs(ratio - 2) < 0.05, `${c}: Pro is about twice Plus a month (${ratio})`);
  }
  // Business prices before GST (066): a year about ten months.
  assert.deepEqual(BUSINESS_PRICE, { business_plus: 499, business_pro: 999, business_enterprise: 3999 });
  assert.deepEqual(BUSINESS_YEAR_PRICE, { business_plus: 4999, business_pro: 9999, business_enterprise: 39999 });
  assert.equal(businessPrice('business_pro'), '₹999 a month + GST');
  assert.equal(businessYearPrice('business_enterprise'), '₹39,999 a year + GST');
  assert.equal(businessAmount('business_plus', 'yearly'), '₹4,999');
  // Reading documents in Indian languages: every paid plan, Plus and up (067).
  assert.ok(plansHaveIndianLanguages(['free', 'plus']));
  assert.ok(plansHaveIndianLanguages(['business_plus']));
  assert.ok(plansHaveIndianLanguages(['free', 'family_pro']));
  assert.ok(plansHaveIndianLanguages(['business_enterprise']));
  assert.ok(!plansHaveIndianLanguages(['free']));
  assert.ok(!plansHaveIndianLanguages([]));
  assert.equal(familyPlanName('plus'), 'Family Plus');
  assert.equal(familyPlanName('family_pro'), 'Family Pro');
  assert.equal(plusYearlySaving('inr', 'family_pro'), 'Save ₹389');
  assert.equal(plusPrice('inr', 'monthly', 'family_pro'), '₹199 a month');
  assert.equal(plusPrice('usd', 'yearly', 'family_pro'), '$199 a year');
  assert.equal(plusTwelveMonths('inr', 'family_pro'), '₹2,388');
  assert.equal(planLabel('family_pro'), 'Family Pro');
  assert.ok(isFamilyPlan('family_pro') && isFamilyPlan('plus') && !isFamilyPlan('business_pro') && !isFamilyPlan('free'));
  // What the creation screen and Help say a person on Free may create: one
  // of each kind since 059, one of either while 054's combined 1 is there,
  // one family before 051 had businesses.
  assert.equal(freeVaultsText(DEFAULT_PLAN_LIMITS), 'one family and one business');
  assert.equal(freeVaultsText({ familiesPerPerson: 1, businessesPerPerson: 1, vaultsPerPerson: 1 }), 'one family or one business');
  assert.equal(freeVaultsText({ familiesPerPerson: 1, businessesPerPerson: 1, vaultsPerPerson: 2 }), 'one family and one business');
  assert.equal(freeVaultsText({ familiesPerPerson: 1, businessesPerPerson: 0, vaultsPerPerson: null }), 'one family');
  assert.equal(freeVaultsText({ familiesPerPerson: 1, businessesPerPerson: 1, vaultsPerPerson: 0 }), null);
  assert.equal(plusYearlySaving('inr'), 'Save ₹189');
  assert.equal(plusYearlySaving('usd'), 'Save $21');
  assert.equal(plusPrice('inr'), '₹99 a month');
  assert.equal(plusPrice('usd'), '$10 a month');
  assert.equal(plusPrice('inr', 'yearly'), '₹999 a year');
  assert.equal(plusPrice('usd', 'yearly'), '$99 a year');
  assert.equal(plusPrices('inr'), '₹99 a month or ₹999 a year');
  assert.equal(plusAmount('inr', 'yearly'), '₹999');
  assert.equal(plusAmount('usd', 'monthly'), '$10');
  // The yearly price is shown against twelve months at the monthly price,
  // crossed out: a real price, worked out, so the discount is a real one.
  assert.equal(plusTwelveMonths('inr'), '₹1,188');
  assert.equal(plusTwelveMonths('usd'), '$120');
  assert.equal(plusYearlyOffer('inr'), '₹999 a year instead of ₹1,188');
  assert.equal(plusYearlyOffer('usd'), '$99 a year instead of $120');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.25 * MB), '1.3 MB');
  assert.equal(formatBytes(250 * MB), '250 MB');
  assert.equal(formatBytes(DEFAULT_PLAN_LIMITS.free), '200 MB');
  assert.equal(formatBytes(DEFAULT_PLAN_LIMITS.freePersonal), '100 MB');
  assert.equal(formatBytes(DEFAULT_PLAN_LIMITS.freeBusiness), '200 MB');
  assert.equal(formatBytes(DEFAULT_PLAN_LIMITS.plus), '5 GB');
  assert.equal(formatBytes(DEFAULT_PLAN_LIMITS.freePerson), '100 MB');
  // A person on Free who has added their 50 MB across their free vaults (060).
  const me = { usedBytes: 48 * MB, limitBytes: 50 * MB };
  assert.ok(personFits(me, 2 * MB), 'a file that exactly fills what is left fits');
  assert.ok(!personFits(me, 3 * MB));
  assert.equal(personStorageFullMessage(me, 3 * MB, { forSale: true }),
    'This file is 3 MB, but you have only 2 MB left of the 50 MB each person can add on Free. Delete documents you added, or move this vault to Family Plus.');
  assert.equal(personStorageFullMessage({ ...me, usedBytes: 50 * MB }, 0, { forSale: false }),
    "You've added 50 MB of the 50 MB each person can add on Free. Delete documents you added to make room. Family Plus is coming soon.");
  assert.equal(personStorageFullMessage({ ...me, usedBytes: 50 * MB }, 1 * MB, { business: true }),
    "You've added 50 MB of the 50 MB each person can add on Free. Delete records you added, or move this business to a paid plan.");
  assert.equal(formatBytes(GB), '1 GB');
  assert.equal(formatBytes(1.5 * GB), '1.5 GB');
  const free = { plan: 'free', limitBytes: GB, usedBytes: GB - 2 * MB };
  assert.ok(fits(free, 2 * MB), 'a file that exactly fills the space fits');
  assert.ok(!fits(free, 3 * MB));
  const tooBig = storageFullMessage(free, 3 * MB);
  assert.match(tooBig, /^This file is 3 MB, but your family has only 2 MB left\./);
  assert.match(tooBig, /Delete documents you don't need/);
  const full = storageFullMessage({ ...free, usedBytes: GB + 10 * MB }, 0, { price: plusPrice('inr') });
  assert.match(full, /^Your family's storage is full, with 1\.01 GB of 1 GB used\./);
  // Until Plus can be bought, nothing offers to sell it.
  if (!PLUS_FOR_SALE) {
    assert.match(full, /Family Plus is coming soon, with 5 GB for ₹99 a month\.$/);
    assert.doesNotMatch(full, /move to/);
  }
  assert.match(storageFullMessage({ ...free, usedBytes: GB }, 0, { price: plusPrices('inr') }), /with 5 GB for ₹99 a month or ₹999 a year\.$/);
  // The server cannot tell where the person is, so it names no price.
  assert.match(storageFullMessage({ ...free, usedBytes: GB }), /with 5 GB\.$/);
  const plus = storageFullMessage({ plan: 'plus', limitBytes: GB, usedBytes: GB }, 0, { price: plusPrice('usd') });
  assert.equal(plus, "Your family's storage is full, with 1 GB of 1 GB used. Delete documents you don't need to make room.");
  // Where Pro can be bought, a full Plus vault is offered its 2 GB (064, 066); a full Pro vault makes room.
  assert.equal(storageFullMessage({ plan: 'plus', limitBytes: GB, usedBytes: GB }, 0, { forSale: true }),
    "Your family's storage is full, with 1 GB of 1 GB used. Delete documents you don't need, or move to Family Pro and get 10 GB.");
  assert.equal(storageFullMessage({ plan: 'family_pro', limitBytes: 10 * GB, usedBytes: 10 * GB }, 0, { forSale: true }),
    "Your family's storage is full, with 10 GB of 10 GB used. Delete documents you don't need to make room.");
  // Plus has ended and the family holds more than Free: the day it loses the excess, and how to keep it.
  const ended = storageFullMessage({ plan: 'free', limitBytes: GB, usedBytes: 3 * GB }, 0, { price: plusPrice('inr'), removalOn: '3 Nov 2026' });
  assert.equal(ended, "Your family's storage is full, with 3 GB of 1 GB used. Family Plus has ended. On 3 Nov 2026, the newest documents over 1 GB will be removed. Renew, or delete documents to get under 1 GB.");
  // Saved chats take the family's storage too (042): on the free plan a chat
  // with no room needs Family Plus; on Plus, room is made by deleting.
  const chatFree = chatStorageFullMessage({ plan: 'free', limitBytes: GB, usedBytes: GB }, { price: plusPrices('inr') });
  assert.match(chatFree, /^There's no room to save this chat\. Your family has used 1 GB of 1 GB\. .*Family Plus/);
  assert.match(chatFree, /5 GB for ₹99 a month or ₹999 a year\./);
  if (!PLUS_FOR_SALE) assert.match(chatFree, /Family Plus is coming soon, with .*Until then, delete documents you don't need\.$/);
  assert.equal(chatStorageFullMessage({ plan: 'plus', limitBytes: GB, usedBytes: GB }, { price: plusPrice('usd') }),
    "There's no room to save this chat. Your family has used 1 GB of 1 GB. Delete documents or saved chats you don't need to make room.");
  assert.equal(chatStorageFullMessage({ plan: 'plus', limitBytes: GB, usedBytes: GB }, { forSale: true }),
    "There's no room to save this chat. Your family has used 1 GB of 1 GB. To save more, move to Family Pro and get 10 GB. Or delete documents you don't need.");
  // A personal vault (048) is "your personal vault", never "your family".
  const mine = { plan: 'free', limitBytes: 100 * MB, usedBytes: 99 * MB, personal: true };
  assert.match(storageFullMessage(mine, 3 * MB), /^This file is 3 MB, but your personal vault has only 1 MB left\./);
  assert.match(storageFullMessage({ ...mine, usedBytes: 100 * MB }), /^Your personal vault is full, with 100 MB of 100 MB used\./);
  assert.match(chatStorageFullMessage({ ...mine, usedBytes: 100 * MB }), /^There's no room to save this chat\. Your personal vault has used 100 MB of 100 MB\./);
  for (const text of [storageFullMessage(mine, 3 * MB), storageFullMessage({ ...mine, usedBytes: 100 * MB }), chatStorageFullMessage(mine)]) {
    assert.doesNotMatch(text, /your family/i, 'a personal vault is not called a family');
  }
});

await test('razorpay: the server sets the price, and only Razorpay\'s signature makes a payment count (044)', async () => {
  // The amounts are PLUS_PRICE's, in paise and cents: what the Plus page shows is what is charged.
  assert.equal(plusOrderAmount('monthly', 'INR'), 9900);
  assert.equal(plusOrderAmount('yearly', 'INR'), 99900);
  assert.equal(plusOrderAmount('monthly', 'USD'), 1000);
  assert.equal(plusOrderAmount('yearly', 'USD'), 9900);
  assert.equal(plusOrderDescription('monthly'), 'Family Plus — 1 month');
  assert.equal(plusOrderDescription('yearly'), 'Family Plus — 1 year');
  // Family Pro (064): PRO_PRICE's amounts, and its own name on the receipt.
  assert.equal(plusOrderAmount('monthly', 'INR', 'family_pro'), 19900);
  assert.equal(plusOrderAmount('yearly', 'INR', 'family_pro'), 199900);
  assert.equal(plusOrderAmount('monthly', 'USD', 'family_pro'), 2000);
  assert.equal(plusOrderAmount('yearly', 'USD', 'family_pro'), 19900);
  assert.equal(plusOrderDescription('monthly', 'family_pro'), 'Family Pro — 1 month');
  // No two plans and periods cost the same, so an unpaid order reused within
  // the hour (050) is the plan it was made for even where 064 is missing.
  const amounts = ['plus', 'family_pro'].flatMap((plan) => ['monthly', 'yearly'].flatMap((period) => ['INR', 'USD'].map((cur) => `${cur}${plusOrderAmount(period, cur, plan)}`)));
  assert.equal(new Set(amounts).size, amounts.length);
  // Rupees unless dollars are switched on; nothing else, ever.
  assert.deepEqual(acceptedCurrencies(undefined), ['INR']);
  assert.deepEqual(acceptedCurrencies(''), ['INR']);
  assert.deepEqual(acceptedCurrencies('inr, usd'), ['INR', 'USD']);
  assert.deepEqual(acceptedCurrencies('EUR,GBP'), ['INR']);
  // WebCrypto's HMAC agrees with Node's, so the signatures are Razorpay's scheme.
  const secret = 'specimen_key_secret_not_real';
  const expected = createHmac('sha256', secret).update('order_Specimen000001|pay_Specimen000001').digest('hex');
  assert.equal(await hmacSha256Hex(secret, 'order_Specimen000001|pay_Specimen000001'), expected);
  assert.ok(await paymentSignatureOk('order_Specimen000001', 'pay_Specimen000001', expected, secret), 'the checkout\'s signature is accepted');
  assert.ok(!(await paymentSignatureOk('order_Specimen000002', 'pay_Specimen000001', expected, secret)), 'not for another order');
  assert.ok(!(await paymentSignatureOk('order_Specimen000001', 'pay_Specimen000001', expected, 'another_secret')), 'not under another secret');
  assert.ok(!(await paymentSignatureOk('order_Specimen000001', 'pay_Specimen000001', expected.toUpperCase(), secret)), 'hex as Razorpay sends it, lowercase');
  assert.ok(!(await paymentSignatureOk('order_Specimen000001', 'pay_Specimen000001', expected, '')), 'never without a secret');
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_Specimen000001', order_id: 'order_Specimen000001', amount: 10000, currency: 'INR', status: 'captured' } } } });
  const hook = createHmac('sha256', 'specimen_webhook_secret').update(body).digest('hex');
  assert.ok(await webhookSignatureOk(body, hook, 'specimen_webhook_secret'));
  assert.ok(!(await webhookSignatureOk(body + ' ', hook, 'specimen_webhook_secret')), 'one byte changed is refused');
  assert.ok(!(await webhookSignatureOk(body, '', 'specimen_webhook_secret')), 'no signature is refused');
  assert.ok(sameText('abc', 'abc') && !sameText('abc', 'abd') && !sameText('abc', 'ab'));
  assert.ok(ORDER_ID.test('order_Specimen000001') && !ORDER_ID.test('order_x') && !ORDER_ID.test('pay_Specimen000001'));
  assert.ok(PAYMENT_ID.test('pay_Specimen000001') && !PAYMENT_ID.test('pay_ bad'));
});

await test('categories: Upload suggests one from the file, never a default, and counts only built-in names', async () => {
  assert.equal(FAMILY_CATEGORIES.length, 23);
  assert.equal(BUSINESS_CATEGORIES.length, 11);
  assert.equal(new Set(BUILT_IN_CATEGORIES).size, 34, 'a family\'s 23 and a business\'s 11, "Other" shared');
  const cases = [
    ['Passport_Asha_Verma.pdf', null, 'Passport'],
    ['scan_1.jpg', 'Government of India  Aadhaar  1234 5678 9012  Asha Verma', 'National ID / Aadhaar'],
    ['IMG_2031.jpg', 'INCOME TAX DEPARTMENT  GOVT. OF INDIA  Permanent Account Number Card  ABCDE1234F', 'PAN Card'],
    ['photo.jpg', 'INCOME TAX DEPARTMENT  ASHA VERMA  ABCDE1234F', 'PAN Card'],
    ['ITR-V_2026.pdf', null, 'Tax Returns'],
    ['ack.pdf', 'Acknowledgement Number 1234  Assessment Year 2026-27  PAN ABCDE1234F', 'Tax Returns'],
    ['health_policy_verma.pdf', null, 'Health Insurance'],
    ['Car insurance 2026.pdf', null, 'Vehicle Insurance'],
    ['ticket.pdf', 'ELECTRONIC RESERVATION SLIP  PNR 4512345678', 'Visa / Travel Docs'],
    ['scan.jpg', 'VISA  Type: Tourist  Passport No. Z1234567', 'Visa / Travel Docs'],
    ['statement.pdf', 'Your VISA card statement  Bank statement for September', 'Bank Statements'],
    ['rate ticket.pdf', null, null],
    ['visa_application.pdf', 'Passport No. Z1234567', 'Visa / Travel Docs'],
    ['electricity_bill_sept.pdf', null, 'Utility Bills'],
    ['Rent Agreement Flat 4B.pdf', null, 'Property Documents'],
    ['Discharge Summary.pdf', null, 'Medical Records'],
    ['fixed_deposit_receipt.pdf', null, 'Bank Statements'],
    ['gas_booking_receipt.jpg', null, 'Utility Bills'],
    ['Salary slip Aug.pdf', null, 'Employment Letters'],
    ['Class 10 marksheet.jpg', null, 'Educational Certificates'],
    ['IMG_2031.jpg', null, null],
    ['resume.pdf', null, null],
    ['policy.pdf', null, null],
    ['citrus_farm.pdf', null, null],
    ['', '', null],
  ];
  for (const [name, text, want] of cases) {
    assert.equal(suggestCategory({ fileName: name, text, audience: 'family' }), want, `${name} / ${text}`);
  }
  // Counting: built-in names as they are; a family's own category never by name.
  assert.equal(countedCategory('Passport'), 'Passport');
  assert.equal(countedCategory('Passport', true), 'Passport');
  assert.equal(countedCategory('Passport', false), 'Other');
  assert.equal(countedCategory("Mom's reports", false), 'Other');
  assert.equal(countedCategory('Something new'), 'Other');
  assert.equal(countedCategory(null), 'None');
  assert.equal(countedCategory('GST Returns', true), 'GST Returns', 'a business\'s built-in names count too');
  // Upload's order: the common ones, then other built-ins, then a business's,
  // then a vault's own, "Other" last.
  assert.ok(categoryOrder('Passport') < categoryOrder('Medical Records'));
  assert.ok(categoryOrder('Medical Records') < categoryOrder('Voter ID'));
  assert.ok(categoryOrder('Voter ID') < categoryOrder('Sales Invoices'));
  assert.ok(categoryOrder('Sales Invoices') < categoryOrder('Tax (ITR/TDS)'));
  assert.ok(categoryOrder('Tax (ITR/TDS)') < categoryOrder(''));
  assert.ok(categoryOrder('') < categoryOrder('Other'));
});

await test('razorpay: the server picks rupees or dollars from where the payer connects, not from a setting', async () => {
  // Cloudflare's header: two letters; "XX" (unknown) and junk are no country.
  assert.equal(connectionCountry('IN'), 'IN');
  assert.equal(connectionCountry(' us '), 'US');
  assert.equal(connectionCountry('XX'), null);
  assert.equal(connectionCountry('T1'), 'T1');
  assert.equal(connectionCountry(''), null);
  assert.equal(connectionCountry(null), null);
  assert.equal(connectionCountry('India'), null);
  // In India, with India's time zone (or none sent): rupees.
  assert.equal(payerCurrency('IN', 'Asia/Kolkata'), 'INR');
  assert.equal(payerCurrency('IN', 'Asia/Calcutta'), 'INR');
  assert.equal(payerCurrency('IN', undefined), 'INR');
  // Abroad: dollars, even with the phone set to India time (an NRI's trick).
  assert.equal(payerCurrency('US', 'Asia/Kolkata'), 'USD');
  assert.equal(payerCurrency('AE', 'Asia/Dubai'), 'USD');
  assert.equal(payerCurrency('T1', 'Asia/Kolkata'), 'USD');
  // In India with another time zone: dollars (both must say India).
  assert.equal(payerCurrency('IN', 'America/New_York'), 'USD');
  // No country: the time zone alone, as the app always did; neither: no opinion.
  assert.equal(payerCurrency(null, 'Asia/Kolkata'), 'INR');
  assert.equal(payerCurrency(null, 'Europe/London'), 'USD');
  assert.equal(payerCurrency(null, undefined), null);
  assert.equal(payerCurrency(null, ''), null);
  assert.equal(payerCurrency(null, 42), null);
  assert.equal(payerCurrencyMessage('USD'), 'From where you are, Family Plus is $10 a month or $99 a year.');
  assert.equal(payerCurrencyMessage('INR'), 'In India, Family Plus is ₹99 a month or ₹999 a year.');
});

await test('the languages suite: by hand only, every language, half a day at most', () => {
  const languages = selectQuestions(questions, 'languages', 1);
  assert.equal(languages.length, 12);
  assert.ok(estimateFor(languages).helperShare <= 0.45, `the languages suite would spend ${Math.round(estimateFor(languages).helperShare * 100)}% of the helper model's day`);
  for (let g = 1; g <= groupCount(questions); g++) {
    assert.ok(!selectQuestions(questions, 'nightly', g).some((q) => q.tier === 'languages'), `nightly group ${g} asks a languages question`);
  }
  assert.ok(!selectQuestions(questions, 'full', 1).some((q) => q.tier === 'languages'), 'full asks a languages question');
  assert.ok(!selectQuestions(questions, 'smoke', 1).some((q) => q.tier === 'languages'));
  // Every language the app offers beyond English and Hindi has a question.
  const fixtureLanguage = new Map(permanentDocuments.map((d) => [d.file, d.language]));
  const covered = new Set(languages.map((q) => fixtureLanguage.get(q.expect.source)));
  for (const lang of ['Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi']) assert.ok(covered.has(lang), `no question about the ${lang} document`);
  // A voice-mode question says what it expects back, in which script.
  const script = { bn: 'bengali', ta: 'tamil', te: 'telugu', mr: 'devanagari', hi: 'devanagari', gu: 'gujarati', kn: 'kannada', ml: 'malayalam', pa: 'gurmukhi' };
  for (const q of languages.filter((x) => x.language)) {
    const base = q.language.split('-')[0];
    assert.ok(q.voice, `${q.id}: the app sends a language only in voice mode`);
    assert.equal(q.expect.answer_language, base, `${q.id}: answer_language`);
    assert.equal(q.expect.script, script[base], `${q.id}: script`);
    assert.ok(q.expect.no_markdown, `${q.id}: a voice answer must be speakable`);
  }
});

await test('questions each month: the count, and the words when they are used up (049)', () => {
  // As claim_question() answers on Free: no `left`, worked out from the ceiling.
  const free = parseAllowance({ allowed: false, used: 20, limit: 20, ceiling: 20, plus: false, resets_on: '2026-11-01' });
  assert.deepEqual(free, { used: 20, limit: 20, ceiling: 20, left: 0, plus: false, resetsOn: '2026-11-01' });
  assert.equal(questionLimitMessage(free),
    "You've used your 20 free questions for this month. They start again on 1 November. Family Plus gives your family more.");
  assert.match(questionLimitMessage(free, 'hi-IN'), /20 मुफ़्त सवाल/);
  assert.match(questionLimitMessage(free, 'hi-IN'), /1 नवंबर/);
  assert.equal(questionsLeftText(free), "You've used your 20 free questions this month");
  // A few left: said, with the plan's number.
  const few = parseAllowance({ used: 17, limit: 20, ceiling: 20, left: 3, plus: false, resets_on: '2026-11-01' });
  assert.equal(questionsLeftText(few), '3 of 20 free questions left this month');
  // A ceiling of one's own: nothing said until it is near; then its own words.
  const plus = parseAllowance({ used: 12, limit: null, ceiling: 500, left: 488, plus: true, resets_on: '2026-11-01' });
  assert.equal(questionsLeftText(plus), null);
  const plusFull = parseAllowance({ allowed: false, used: 500, limit: null, ceiling: 500, plus: true, resets_on: '2026-12-01' });
  assert.equal(questionLimitMessage(plusFull),
    "You've reached this month's limit of 500 questions. They start again on 1 December.");
  // Family Plus (053): the family's 200 shared; said once 50 or fewer are left.
  const family = parseAllowance({ used: 40, limit: null, ceiling: 200, left: 20, plus: true, resets_on: '2026-11-01',
    family_limit: 200, family_used: 180, family_left: 20 });
  assert.deepEqual(family, { used: 40, limit: null, ceiling: 200, left: 20, plus: true, resetsOn: '2026-11-01',
    familyLimit: 200, familyUsed: 180, familyLeft: 20, familyKind: 'family' });
  assert.equal(questionsLeftText(family), '20 of 200 family questions left this month');
  assert.equal(questionsLeftText({ ...family, familyUsed: 100, familyLeft: 100, left: 100 }), null);
  const familyFull = parseAllowance({ allowed: false, reason: 'family', used: 40, limit: null, ceiling: 200, plus: true,
    resets_on: '2026-11-01', family_limit: 200, family_used: 200, family_left: 0 });
  assert.equal(familyFull.reason, 'family');
  assert.equal(questionLimitMessage(familyFull), "Your family has used its 200 questions for this month. They start again on 1 November.");
  assert.match(questionLimitMessage(familyFull, 'hi-IN'), /परिवार के इस महीने के 200 सवाल/);
  assert.equal(questionsLeftText({ ...familyFull, left: 0 }), 'Your family has used its 200 questions this month');
  // A business's shared month (066), in its own words; a tenth left before it is said.
  const team = parseAllowance({ used: 3, limit: null, ceiling: 5000, left: 400, plus: true, resets_on: '2026-11-01',
    family_limit: 5000, family_used: 4600, family_left: 400, family_kind: 'business', plans: ['business_pro', 'free'] });
  assert.equal(team.familyKind, 'business');
  assert.deepEqual(team.plans, ['business_pro', 'free']);
  assert.equal(questionsLeftText(team), '400 of 5,000 business questions left this month');
  assert.equal(questionsLeftText({ ...team, familyUsed: 4000, familyLeft: 1000, left: 1000 }), null);
  assert.equal(questionLimitMessage({ ...team, reason: 'family', familyLeft: 0, familyUsed: 5000 }),
    'Your business has used its 5,000 questions for this month. They start again on 1 November.');
  assert.deepEqual(parseAllowance(allowanceJson(team)), team);
  // Given back: to the person and to the family.
  assert.deepEqual(givenBack(family), { ...family, used: 39, familyUsed: 179, familyLeft: 21, left: 21 });
  assert.deepEqual(parseAllowance(allowanceJson(family)), family);
  // A question given back: one fewer used, one more left; never below zero.
  assert.deepEqual(givenBack(few), { ...few, used: 16, left: 4 });
  assert.equal(givenBack({ ...few, used: 0, left: 20 }).used, 0);
  // What rag-search sends is what the app reads back.
  assert.deepEqual(parseAllowance(allowanceJson(few)), few);
  // Before 049, or anything else: not an allowance.
  assert.equal(parseAllowance(null), null);
  assert.equal(parseAllowance({ allowed: true }), null);
  assert.equal(resetDay('2027-01-01'), '1 January');
  assert.equal(resetDay('soon'), null);
});

await test('limits against abuse (050): a vault reads only its own folder, and the words for each limit', () => {
  const ns = 'family_4f673322';
  // Inside the vault's own folder: "<namespace>/<file>", as the app and Gmail import write it.
  assert.ok(inVaultFolder(`${ns}/1790715383718_passport.pdf`, ns));
  // Anywhere else is another family's file, or nobody's.
  for (const path of [
    'family_5fbc8888/1790715383718_passport.pdf',           // another vault's
    `${ns}x/a.pdf`, `${ns}`, `${ns}/`, `/${ns}/a.pdf`,       // not quite inside
    `${ns}/../family_5fbc8888/a.pdf`, `${ns}/./a.pdf`, `${ns}//a.pdf`, `${ns}/a\\b.pdf`,
    `${ns}/${'x'.repeat(1100)}`, null, 42,
  ]) assert.equal(inVaultFolder(path, ns), false, String(path));
  // A namespace that is not one cannot vouch for anything.
  assert.equal(inVaultFolder('public/a.pdf', 'public'), false);
  assert.equal(inVaultFolder('family_%/a.pdf', 'family_%'), false);
  // Text the app sends: a few thousand characters a page, never more than the file has bytes.
  assert.equal(providedTextLimit(100), 20_100);
  assert.equal(providedTextLimit(null), 20_000);
  assert.equal(providedTextLimit(NaN), 20_000);
  assert.equal(providedTextLimit(50 * 1024 * 1024), MAX_DOCUMENT_TEXT);
  // 10 MB a file, in the bucket, the app and Gmail import alike.
  assert.equal(MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_IMPORT_BYTES, MAX_FILE_BYTES);
  assert.equal(fileTooLargeMessage(14.2 * 1024 * 1024),
    'This file is 14.2 MB. The limit is 10 MB. Try a lower-quality scan, or split it into parts.');
  assert.ok(QUESTION_INPUT_MAX < MAX_QUESTION_CHARS);
  // The refusals the app shows in the database's own words, and nothing else.
  assert.equal(limitHint({ hint: 'upload_limit', message: 'x' }), 'upload_limit');
  assert.equal(limitHint({ hint: 'storage_full' }), null);
  assert.equal(limitHint(null), null);
  // The day's tries: answered or not, and the words say so.
  const tried = parseAllowance({ allowed: false, reason: 'tries', tries: 10, tries_limit: 10, used: 4, limit: 20, ceiling: 20, plus: false, resets_on: '2026-11-01' });
  assert.equal(tried.reason, 'tries');
  assert.equal(questionLimitMessage(tried),
    "You've reached today's limit of 10 questions on Free. Every question counts, answered or not. You can ask again tomorrow.");
  assert.equal(questionLimitMessage({ ...tried, plus: true, triesLimit: 100 }),
    "You've reached today's limit of 100 questions. You can ask again tomorrow.");
  assert.ok(questionLimitMessage(tried, 'hi-IN').includes('कल फिर से'));
  // The month's limit is said as before, and a reply without 050's fields has none of them.
  assert.ok(questionLimitMessage({ ...tried, reason: 'month', used: 20 }).startsWith("You've used your 20 free questions"));
  assert.deepEqual(parseAllowance(allowanceJson(tried)), tried);
  assert.equal('reason' in parseAllowance({ used: 1, limit: 20, ceiling: 20 }), false);
});

await test('business papers: a GSTIN only with its check character, and an invoice\'s details (051)', () => {
  // Fictional numbers: the check character is worked out here, from the
  // 14 before it, the way GST's own rule does.
  const seller = `27ABCDE1234F1Z${gstinCheckChar('27ABCDE1234F1Z')}`;
  const buyer = `07ZZZZZ9999Z1Z${gstinCheckChar('07ZZZZZ9999Z1Z')}`;
  assert.equal(seller, '27ABCDE1234F1Z0');
  assert.equal(buyer, '07ZZZZZ9999Z1ZA');
  assert.ok(isValidGstin(seller) && isValidGstin(buyer) && isValidGstin(seller.toLowerCase()));
  assert.ok(!isValidGstin('27ABCDE1234F1Z1'), 'one wrong character');
  assert.ok(!isValidGstin('27ABCDE1243F1Z0'), 'two characters swapped');
  assert.ok(!isValidGstin(`00ABCDE1234F1Z${gstinCheckChar('00ABCDE1234F1Z')}`), 'no state 00');
  assert.ok(!isValidGstin('27ABCDE1234F1Z'), 'too short');
  assert.equal(gstinCheckChar('27abcde1234f1z'), null, 'lower case is for isValidGstin to fold');

  const invoice = [
    'SPECIMEN — fictional, for AskLocker QA',
    'TAX INVOICE',
    `Sharma Traders (SPECIMEN)   GSTIN: ${seller}`,
    `Bill To: Acme Specimen Pvt Ltd   GSTIN: ${buyer}`,
    'Invoice No.: INV/2026-27/0042   Invoice Date: 12/03/2026',
    'Due Date: 11-04-2026',
    'Taxable value 10,000.00   IGST 18% 1,800.00',
    'Grand Total: ₹11,800.00',
  ].join('\n');
  const meta = extractMetadata(invoice);
  const all = (key) => meta.filter((m) => m.key === key).map((m) => m.value);
  assert.deepEqual(all('gstin'), [seller, buyer]);
  assert.deepEqual(all('invoice_number'), ['INV/2026-27/0042']);
  assert.deepEqual(all('invoice_date'), ['12/03/2026']);
  assert.deepEqual(all('due_date'), ['11-04-2026']);
  assert.deepEqual(all('total_amount'), ['11,800.00']);
  assert.deepEqual(all('amount'), [], 'the total is not stored twice');
  assert.deepEqual(all('expiry_date'), [], 'a due date is not an expiry');
  // A GSTIN with an OCR slip is not stored at all.
  assert.deepEqual(extractMetadata('GSTIN: 27ABCDE1234F1Z1').filter((m) => m.key === 'gstin'), []);
  assert.deepEqual(extractMetadata('Invoice No. pending').filter((m) => m.key === 'invoice_number'), [], 'a number has a digit');
  assert.deepEqual(extractMetadata('Invoice Date: 5 March 2026').filter((m) => m.key === 'invoice_date').map((m) => m.value), ['5 March 2026']);

  // A licence's validity becomes an expiry date, and so the expiry reminders.
  const expiries = (t) => extractMetadata(t).filter((m) => m.key === 'expiry_date').map((m) => m.value);
  assert.deepEqual(expiries('FSSAI Licence (SPECIMEN)\nValid up to: 31-03-2027'), ['31-03-2027']);
  assert.deepEqual(expiries('Trade Licence (SPECIMEN) valid upto 31/03/2027'), ['31/03/2027']);
  assert.deepEqual(expiries('Shop and Establishment (SPECIMEN)\nValidity: 31/12/2027'), ['31/12/2027']);
  assert.deepEqual(expiries('Renewal due: 15.06.2027'), ['15.06.2027']);
  assert.deepEqual(expiries('Valid till 30 June 2027'), ['30 June 2027']);
  assert.deepEqual(expiries('Validity: 5 years'), [], 'no date, no expiry');
  assert.equal(parseFlexibleDate('31-03-2027'), '2027-03-31');
  // A family's papers read as before: an insurance total is still its amount.
  const policy = extractMetadata('Total Premium: 12,000');
  assert.deepEqual(policy.map((m) => `${m.key}=${m.value}`), ['amount=12,000']);
});

await test('a category suggested from the file\'s name and text, from the vault\'s own list (051)', () => {
  const biz = (fileName, text) => suggestCategory({ fileName, text, audience: 'business' });
  const fam = (fileName, text) => suggestCategory({ fileName, text, audience: 'family' });
  assert.equal(biz('GSTR-3B_March_2026.pdf'), 'GST Returns');
  assert.equal(biz('gst return q4.pdf'), 'GST Returns');
  assert.equal(biz('FSSAI licence.pdf'), 'Licences & Registrations');
  assert.equal(biz('Udyam-Registration-Certificate.pdf'), 'Licences & Registrations');
  assert.equal(biz('scan.jpg', 'Form REG-06 Registration Certificate (SPECIMEN)'), 'Licences & Registrations');
  assert.equal(biz('Shop & Establishment.pdf'), 'Licences & Registrations');
  assert.equal(biz('payslip_march.pdf', 'TDS deducted 2,000'), 'Payroll', 'a payslip mentions TDS: still payroll');
  assert.equal(biz('Salary Register Mar.pdf'), 'Payroll');
  assert.equal(biz('Form16_FY2025-26.pdf'), 'Tax (ITR/TDS)');
  assert.equal(biz('ITR-V acknowledgement.pdf'), 'Tax (ITR/TDS)');
  assert.equal(biz('Rent Agreement - Godown.pdf'), 'Lease & Property', 'a lease before a contract');
  assert.equal(biz('Leave and Licence agreement.pdf'), 'Lease & Property');
  assert.equal(biz('NDA with Specimen Ltd.pdf'), 'Contracts & Agreements');
  assert.equal(biz('Distribution Agreement.pdf'), 'Contracts & Agreements');
  assert.equal(biz('Purchase Order 0042.pdf'), 'Purchase Bills');
  assert.equal(biz('scan.jpg', 'Supplier: Sharma Traders (SPECIMEN)'), 'Purchase Bills');
  assert.equal(biz('Tax Invoice 0042.pdf'), 'Sales Invoices');
  assert.equal(biz('e-way bill.pdf'), 'Sales Invoices');
  assert.equal(biz('HDFC loan sanction letter.pdf'), 'Bank & Loans');
  assert.equal(biz('bank statement march.pdf'), 'Bank & Loans');
  assert.equal(biz('Fire insurance policy.pdf'), 'Business Insurance');
  assert.equal(biz('Offer Letter - Ravi.pdf'), 'Employee Records');
  assert.equal(biz('IMG_2041.jpg'), null, 'nothing to go on');
  // The file's name speaks first: a person named it.
  assert.equal(biz('Tax Invoice 0042.pdf', 'Registration Certificate'), 'Sales Invoices');

  assert.equal(fam('Mom passport.pdf'), 'Passport');
  assert.equal(fam('aadhar card.jpg'), 'National ID / Aadhaar');
  assert.equal(fam('e-PAN.pdf'), 'PAN Card');
  assert.equal(fam('ITR-V 2025.pdf'), 'Tax Returns', 'a tax return before a PAN card');
  assert.equal(fam('scan.jpg', 'Union of India Driving Licence DL No MH12 20110012345'), 'Driving License');
  assert.equal(fam('Star mediclaim policy.pdf'), 'Health Insurance');
  assert.equal(fam('LIC term plan.pdf'), 'Life Insurance');
  assert.equal(fam('car insurance 2026.pdf'), 'Vehicle Insurance');
  assert.equal(fam('electricity bill sept.pdf'), 'Utility Bills');
  assert.equal(fam('Goa e-ticket.pdf'), 'Visa / Travel Docs');
  assert.equal(fam('Class 10 marksheet.pdf'), 'Educational Certificates');
  assert.equal(fam('Fridge warranty.pdf'), 'Warranty Cards');

  // Only the vault's own list: a laptop bill in a family vault is not a Sales Invoice.
  assert.equal(fam('Laptop invoice.pdf'), null);
  assert.equal(fam('GSTR-3B March.pdf'), null);
  assert.equal(biz('Mom passport.pdf'), null);
  // Every name is a built-in category's (migrations 003 and 051).
  const builtIn = new Set(['Passport', 'National ID / Aadhaar', 'PAN Card', 'Driving License', 'Voter ID', 'Birth Certificate',
    'Marriage Certificate', 'Death Certificate', 'Health Insurance', 'Life Insurance', 'Vehicle Insurance', 'Property Documents',
    'Tax Returns', 'Bank Statements', 'Medical Records', 'Prescriptions', 'Educational Certificates', 'Employment Letters',
    'Utility Bills', 'Visa / Travel Docs', 'Legal Documents', 'Warranty Cards', 'Other',
    'Sales Invoices', 'Purchase Bills', 'GST Returns', 'Contracts & Agreements', 'Licences & Registrations', 'Bank & Loans',
    'Business Insurance', 'Employee Records', 'Payroll', 'Lease & Property', 'Tax (ITR/TDS)']);
  for (const c of [...SUGGESTED_CATEGORIES.family, ...SUGGESTED_CATEGORIES.business]) assert.ok(builtIn.has(c), c);
  assert.equal(SUGGESTED_CATEGORIES.business.length, 11, 'every business category but Other can be suggested');
});

await test('business plans: Plus, Pro and Enterprise, their prices and words, and a closed business (051)', () => {
  const GB = 1024 ** 3, MB = 1024 ** 2;
  assert.equal(DEFAULT_PLAN_LIMITS.businessesPerPerson, 1);
  assert.deepEqual(BUSINESS_PLANS, ['business_plus', 'business_pro', 'business_enterprise']);
  assert.ok(BUSINESS_PLANS.every(isBusinessPlan) && !isBusinessPlan('plus') && !isBusinessPlan('business') && !isBusinessPlan(null));
  // Each plan up has more people and more space, and never less of anything
  // (questions: null is no monthly limit, the most).
  const atLeast = (higher, lower) => higher === null || (lower !== null && higher >= lower);
  for (let i = 1; i < BUSINESS_PLANS.length; i++) {
    const lower = DEFAULT_PLAN_LIMITS.business[BUSINESS_PLANS[i - 1]], higher = DEFAULT_PLAN_LIMITS.business[BUSINESS_PLANS[i]];
    assert.ok(higher.members > lower.members && higher.storage > lower.storage, `${BUSINESS_PLANS[i]} has more people and space`);
    for (const k of Object.keys(lower)) {
      if (typeof lower[k] === 'boolean') continue;
      assert.ok(atLeast(higher[k], lower[k]), `${BUSINESS_PLANS[i]}'s ${k} is not below`);
    }
  }
  assert.deepEqual(BUSINESS_PRICE, { business_plus: 499, business_pro: 999, business_enterprise: 3999 });
  assert.equal(businessAmount('business_plus'), '₹499');
  assert.equal(businessAmount('business_enterprise'), '₹3,999');
  assert.equal(businessPrice('business_pro'), '₹999 a month + GST');
  assert.equal(businessYearPrice('business_plus'), '₹4,999 a year + GST', 'a year is about ten months');
  assert.equal(businessYearPrice('business_pro'), '₹9,999 a year + GST');
  assert.equal(businessYearPrice('business_enterprise'), '₹39,999 a year + GST');
  for (const p of BUSINESS_PLANS) assert.ok(BUSINESS_YEAR_PRICE[p] < 12 * BUSINESS_PRICE[p], `${p}: a year costs less than twelve months`);
  assert.equal(planLabel('business_plus'), 'Plus');
  assert.equal(planLabel('business_pro'), 'Pro');
  assert.equal(planLabel('business_enterprise'), 'Enterprise');
  assert.equal(planLabel('plus'), 'Family Plus');
  assert.equal(plusName(true), 'Plus');
  assert.equal(nextBusinessPlan('free'), 'business_plus');
  assert.equal(nextBusinessPlan('business_plus'), 'business_pro');
  assert.equal(nextBusinessPlan('business_pro'), 'business_enterprise');
  assert.equal(nextBusinessPlan('business_enterprise'), null);
  const shop = { plan: 'free', limitBytes: 100 * MB, usedBytes: 99 * MB, business: true };
  assert.match(storageFullMessage(shop, 3 * MB), /^This file is 3 MB, but your business has only 1 MB left\./);
  // Never Family Plus, nor its price, for a business.
  const shopFull = storageFullMessage({ ...shop, usedBytes: 100 * MB }, 0, { forSale: true, price: plusPrice('inr') });
  assert.equal(shopFull, "Your business's storage is full, with 100 MB of 100 MB used. Delete records you don't need, or move to Plus for 20 GB.");
  assert.equal(storageFullMessage({ plan: 'business_plus', limitBytes: 20 * GB, usedBytes: 20 * GB, business: true }),
    "Your business's storage is full, with 20 GB of 20 GB used. Delete records you don't need, or move to Pro for 50 GB.");
  assert.match(chatStorageFullMessage({ ...shop, usedBytes: 100 * MB }), /^There's no room to save this chat\. Your business has used 100 MB of 100 MB\. To save more, move to Plus for 20 GB\./);
  for (const text of [storageFullMessage(shop, 3 * MB), shopFull, chatStorageFullMessage(shop)]) {
    assert.doesNotMatch(text, /family/i, 'a business is not called a family');
  }
  // A paid plan that ended: every record stays, adding waits for the plan.
  assert.ok(!fits({ ...shop, usedBytes: 5 * MB, closed: true }, 1), 'nothing fits in a closed business');
  assert.ok(fits({ ...shop, usedBytes: 5 * MB }, 1));
  assert.equal(storageFullMessage({ ...shop, usedBytes: 5 * MB, closed: true }, 3 * MB), CLOSED_MESSAGE);
  assert.equal(CLOSED_MESSAGE, "Your business's plan has ended. Your records stay. To add new ones, renew the plan.");
  assert.equal(storageFullMessage({ plan: 'business_pro', limitBytes: 50 * GB, usedBytes: 50 * GB, business: true }),
    "Your business's storage is full, with 50 GB of 50 GB used. Delete records you don't need, or move to Enterprise for 200 GB.");
  assert.equal(storageFullMessage({ plan: 'business_enterprise', limitBytes: 100 * GB, usedBytes: 100 * GB, business: true }),
    "Your business's storage is full, with 100 GB of 100 GB used. Delete records you don't need to make room.");
  assert.equal(chatStorageFullMessage({ plan: 'business_enterprise', limitBytes: 100 * GB, usedBytes: 100 * GB, business: true }),
    "There's no room to save this chat. Your business has used 100 GB of 100 GB. Delete records or saved chats you don't need to make room.");
  for (const text of [shopFull, chatStorageFullMessage({ ...shop, usedBytes: 200 * MB }, { forSale: true, price: plusPrice('inr') })]) {
    assert.doesNotMatch(text, /₹100|Family Plus/, 'a business is never offered Family Plus');
  }
});

await test('spreadsheets: every row says what its numbers are, and a CSV read as Excel writes it', () => {
  // A household sheet: a title row, a header, a date, a blank cell, float noise.
  const house = spreadsheetText('Household expenses 2026.xlsx', [{
    name: 'Expenses',
    rows: [
      ['SPECIMEN Household expenses 2026', null, null, null],
      [],
      ['Month', 'Rent', 'Electricity', 'Paid on'],
      ['Jan', 18000, 2210.5, new Date(Date.UTC(2026, 0, 5))],
      ['Feb', 18000, null, new Date(Date.UTC(2026, 1, 4))],
      ['Mar', 18000, 0.1 + 0.2, null],
    ],
  }]);
  assert.equal(house.text, [
    'Spreadsheet: Household expenses 2026.xlsx',
    'Sheet: Expenses',
    'SPECIMEN Household expenses 2026',
    'Month: Jan | Rent: 18000 | Electricity: 2210.5 | Paid on: 05/01/2026',
    'Month: Feb | Rent: 18000 | Paid on: 04/02/2026',
    'Month: Mar | Rent: 18000 | Electricity: 0.3',
  ].join('\n'));
  assert.deepEqual([house.sheets, house.rows, house.truncated], [1, 3, false]);
  // A bank statement: the blank Credit cell no longer hides which column 1,240.00 is in.
  const bank = spreadsheetText('Statement.xlsx', [{ name: 'Sept', rows: [
    ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    ['02/09/2026', 'UPI/Sharma Kirana', '1,240.00', '', '47,010.00'],
    ['05/09/2026', 'Salary Sept', '', '62,500.00', '1,09,510.00'],
  ] }]);
  assert.match(bank.text, /^Date: 02\/09\/2026 \| Description: UPI\/Sharma Kirana \| Debit: 1,240\.00 \| Balance: 47,010\.00$/m);
  assert.match(bank.text, /^Date: 05\/09\/2026 \| Description: Salary Sept \| Credit: 62,500\.00 \| Balance: 1,09,510\.00$/m);
  // Two sheets: each row names its sheet, so a passage cut from the middle still says where it came from.
  const two = spreadsheetText('Sales.xlsx', [
    { name: '2025', rows: [['Month', 'Sales'], ['Jan', 41000]] },
    { name: '2026', rows: [['Month', 'Sales'], ['Jan', 52000]] },
    { name: 'Empty', rows: [[], [null]] },
  ]);
  assert.match(two.text, /^\[2025\] Month: Jan \| Sales: 41000$/m);
  assert.match(two.text, /^\[2026\] Month: Jan \| Sales: 52000$/m);
  assert.equal(two.sheets, 2, 'an empty sheet is left out');
  // A list of words only (no numbers under the header) still finds its header; a time alone keeps its time.
  const list = spreadsheetText('Contacts.xlsx', [{ name: 'People', rows: [['Name', 'Relation', 'Call at'], ['Asha Verma', 'Self', new Date(Date.UTC(1899, 11, 30, 9, 30))]] }]);
  assert.match(list.text, /^Name: Asha Verma \| Relation: Self \| Call at: 09:30$/m);
  // Lines above the header stay as they are; a second table after a blank row has its own header.
  const second = spreadsheetText('Invoice.xlsx', [{ name: 'Inv', rows: [
    ['Company', 'Sharma Traders'], ['GSTIN', '21ABCDE1234F1Z5'], [],
    ['Item', 'Qty', 'Amount'], ['Rice 25 kg', 4, 5200], [],
    ['Tax', 'Rate'], ['CGST', '2.5%'],
  ] }]);
  assert.match(second.text, /^Company \| Sharma Traders$/m);
  assert.match(second.text, /^Item: Rice 25 kg \| Qty: 4 \| Amount: 5200$/m);
  assert.match(second.text, /^Tax: CGST \| Rate: 2\.5%$/m);
  // A huge sheet is cut, and says how much was left.
  const big = spreadsheetText('Big.xlsx', [{ name: 'Rows', rows: [['Item', 'Amount'], ...Array.from({ length: 5000 }, (_, i) => [`Item ${i}`, i])] }], 2000);
  assert.ok(big.truncated && big.text.length <= 2100 && /more rows not read\)$/.test(big.text), big.text.slice(-80));
  // CSV: quotes, a doubled quote, a line break inside a quoted cell, CRLF, a BOM, and Excel's semicolons in some regions.
  assert.deepEqual(parseCsv('\uFEFFName,Note,Amount\r\n"Verma, Asha","said ""hi""",500\r\n"Two\nlines",,\r\n'),
    [['Name', 'Note', 'Amount'], ['Verma, Asha', 'said "hi"', '500'], ['Two\nlines', '', '']]);
  assert.deepEqual(parseCsv('Month;Rent\nJan;18000\n'), [['Month', 'Rent'], ['Jan', '18000']]);
  assert.equal(spreadsheetText('Rent.csv', [{ name: '', rows: parseCsv('Month,Rent\nJan,18000') }]).text,
    'Spreadsheet: Rent.csv\nMonth: Jan | Rent: 18000', 'a CSV has no sheet line');
  assert.ok(isSpreadsheetType('xlsx') && isSpreadsheetType('csv') && !isSpreadsheetType('xls') && !isSpreadsheetType('pdf'));
  // The app may send a spreadsheet twenty times its size in text, under the same ceiling.
  assert.equal(providedTextLimit(10_000, true), 220_000);
  assert.equal(providedTextLimit(10_000), 30_000);
  assert.equal(providedTextLimit(5_000_000, true), MAX_DOCUMENT_TEXT);
});

await test('spreadsheets: a month column is named as people say it, and no passage holds a row without its name', () => {
  // "the Jan 2025 figure" must meet a column named 2025M01 (found on 20 October 2026).
  for (const [code, said] of [
    ['2025M01', 'Jan 2025'], ['2025-03', 'Mar 2025'], ['03/2025', 'Mar 2025'], ['Jan-25', 'Jan 2025'],
    ["Sept'24", 'Sep 2024'], ['2025Q1', 'Q1 2025'], ['Q2-25', 'Q2 2025'],
    ['Jan25', 'Jan 2025'], ['Mar.2025', 'Mar 2025'], ['January 2025', 'January 2025'], ['Jan 2025', 'Jan 2025'],
    ['2011-12', '2011-12'], ['2024-25', '2024-25'], ['Dec 31', 'Dec 31'],
    ['2025M13', '2025M13'], ['Marks 25', 'Marks 25'], ['May', 'May'], ['Total', 'Total'],
  ]) assert.equal(periodLabel(code), said, code);
  const months = spreadsheetText('Loans.xlsx', [{ name: 'L', rows: [
    ['RowId', 'Segment', 'Country', 'Metric', '2024M12', '2025M01'],
    ['FIN-035', 'Treasury', 'India', 'Loans', 22581, 22872],
  ] }]);
  assert.match(months.text, /^RowId: FIN-035 \| Segment: Treasury \| Country: India \| Metric: Loans \| Dec 2024: 22581 \| Jan 2025: 22872$/m);
  // Excel month columns are dates: a header of dates over numbers is a header, the 1st or the month's end is a month.
  const excel = spreadsheetText('Excel months.xlsx', [{ name: 'E', rows: [
    ['Segment', 'Country', new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 1, 1))],
    ['Treasury', 'India', 22872, 23068],
  ] }, { name: 'F', rows: [
    ['Item', new Date(Date.UTC(2025, 0, 31)), new Date(Date.UTC(2025, 1, 28))],
    ['Rent', 18000, 18000],
  ] }]);
  assert.match(excel.text, /^\[E\] Segment: Treasury \| Country: India \| Jan 2025: 22872 \| Feb 2025: 23068$/m);
  assert.match(excel.text, /^\[F\] Item: Rent \| Jan 2025: 18000 \| Feb 2025: 18000$/m);
  const years = spreadsheetText('Years.xlsx', [{ name: '', rows: [['Item', 2023, 2024], ['Rent', 216000, 228000]] }]);
  assert.match(years.text, /^Item: Rent \| 2023: 216000 \| 2024: 228000$/m);
  // A pivot: no name over the first column, a month with nothing in it on the first row.
  const pivot = spreadsheetText('Pivot.xlsx', [{ name: '', rows: [
    [null, new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 1, 1)), new Date(Date.UTC(2025, 2, 1))],
    ['Rent', 18000, null, 18000],
  ] }]);
  assert.match(pivot.text, /^Column A: Rent \| Jan 2025: 18000 \| Mar 2025: 18000$/m);
  // A statement with no header row is not given one: its dates sit over dates, its amounts are amounts.
  const bare = spreadsheetText('Bare.csv', [{ name: '', rows: [['02/09/2026', 'UPI', '1240'], ['03/09/2026', 'ATM', '500']] }]);
  assert.match(bare.text, /^02\/09\/2026 \| UPI \| 1240$/m);
  assert.equal(bare.rows, 0);

  // A row too wide for one passage: every line opens with what the row is, and every value is kept once.
  const codes = Array.from({ length: 120 }, (_, i) => `${2015 + Math.floor(i / 12)}M${String((i % 12) + 1).padStart(2, '0')}`);
  const wide = spreadsheetText('Wide.xlsx', [{ name: 'W', rows: [
    ['RowId', 'Segment', 'Country', 'Metric', ...codes, 'Notes'],
    ['FIN-035', 'Treasury', 'India', 'Loans', ...codes.map((_, i) => 20000 + i), `SPECIMEN ${'restated after audit '.repeat(150)}end of note`],
  ] }]);
  const wideRows = wide.text.split('\n').slice(2);
  assert.ok(wideRows.length > 2, `${wideRows.length} lines`);
  for (const line of wideRows) {
    assert.ok(line.startsWith('RowId: FIN-035 | Segment: Treasury | Country: India | Metric: Loans | '), line.slice(0, 90));
    assert.ok(estimateTokens(line) <= MAX_ROW_TOKENS, `${estimateTokens(line)} tokens`);
  }
  for (let i = 0; i < 120; i++) assert.equal(wide.text.split(`: ${20000 + i}`).length - 1, 1, `value ${20000 + i}`);
  assert.match(wide.text, /end of note$/, 'a long note is written across lines, not cut');
  assert.equal(wide.rows, 1);

  // Numbers cost about twice the tokens of words (o200k, 20 October 2026: a spreadsheet's rows were
  // 10,472 tokens, which characters alone put at 5,524), so a row of 60 months is two lines, both named.
  const row = 'RowId: FIN-035 | Segment: Treasury | Country: India | Metric: Loans | ' + codes.slice(0, 30).map((c, i) => `${periodLabel(c)}: ${20085 + i * 97}`).join(' | ');
  assert.ok(estimateTokens(row) > 1.6 * Math.ceil(row.length / 4), `${estimateTokens(row)} tokens for ${row.length} characters`);
  assert.equal(estimateTokens('The rent is paid by the fifth.'), Math.ceil('The rent is paid by the fifth.'.length / 4), 'words alone count as before');
  assert.equal(estimateTokens('आशा'), 2, 'Indic text at double weight, as before');
  const sixty = spreadsheetText('Financials.xlsx', [{ name: '', rows: [
    ['RowId', 'Segment', 'Country', 'Metric', ...codes.slice(0, 60)],
    ['FIN-035', 'Treasury', 'India', 'Loans', ...codes.slice(0, 60).map((_, i) => 20085 + i * 97)],
  ] }]).text.split('\n').slice(1);
  assert.equal(sixty.length, 2, sixty.join('\n'));
  assert.ok(sixty.every((l) => l.startsWith('RowId: FIN-035 | Segment: Treasury | Country: India | Metric: Loans | ')));

  // Passages: a spreadsheet is cut only between its lines, with no overlap, so every line of every
  // passage is a whole line of the text. (An overlap once carried 2025M01 of one row beside the next row.)
  const sheet = spreadsheetText('Financials.xlsx', [{ name: 'Financials', rows: [
    ['RowId', 'Segment', 'Country', 'Metric', ...codes.slice(96)],
    ...Array.from({ length: 36 }, (_, r) => [`FIN-${String(r + 1).padStart(3, '0')}`, ['Retail', 'Treasury', 'Wealth'][r % 3], ['India', 'UK', 'USA'][r % 3], 'Loans', ...codes.slice(96).map((_, i) => 1000 * r + i)]),
  ] }, { name: 'Metrics', rows: [['Metric', 'Shown as'], ['Loans', 'USD thousands']] }]);
  assert.ok(isSpreadsheetText(sheet.text) && !isSpreadsheetText('Passport\nSpreadsheet: no'));
  const whole = new Set(sheet.text.split('\n'));
  const passages = chunkText(sheet.text);
  assert.ok(passages.length > 5, `${passages.length} passages`);
  for (const p of passages) for (const line of p.content.split('\n')) assert.ok(whole.has(line), `cut line: ${line.slice(0, 60)}`);
  assert.equal(passages.map((p) => p.content).join('\n'), sheet.text, 'nothing repeated, nothing lost');
  // Other text keeps its overlap.
  const prose = Array.from({ length: 60 }, (_, i) => `Clause ${i} of the SPECIMEN agreement says the rent is paid by the fifth.`).join('\n');
  const proseParts = chunkText(prose);
  assert.ok(proseParts.length > 1 && proseParts[0].content.endsWith(proseParts[1].content.split('\n')[0].slice(-20)), 'prose overlaps');
});

await test('the agreement the app shows is word for word what the database keeps (062)', () => {
  // The record must say what the screen said: each version's words are
  // inserted by a migration, and the app's agreementText() must match them.
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(new URL(f, dir), 'utf8'));
  const quoted = (sql) => [...sql.matchAll(/values \('([^']+)', \$agreement\$([\s\S]*?)\$agreement\$\)/g)];
  const kept = migrations.flatMap(quoted).find((m) => m[1] === AGREEMENT_VERSION);
  assert.ok(kept, `no migration inserts agreement version ${AGREEMENT_VERSION}: write one with the new words`);
  assert.equal(kept[2], agreementText(), `version ${AGREEMENT_VERSION}'s words differ from the app's: a new version needs a new migration`);
  // Plain words, never a privacy claim the app does not keep (CLAUDE.md):
  // no end-to-end at all (documents are not), and "only people in your
  // vault" only with its limit, "in AskLocker".
  const words = agreementText().toLowerCase();
  assert.ok(!words.includes('end-to-end'), 'claims nothing about end-to-end');
  assert.ok(!words.includes('only people in your vault') || words.includes('in asklocker, only people in your vault'), 'keeps "In AskLocker" on who can open them');
  for (const claim of ['100% private', 'only you can see', 'nothing is kept', 'secure', 'bank-level', 'military-grade']) {
    assert.ok(!words.includes(claim), `promises "${claim}"`);
  }
  // It says outside services read parts of documents, but names none (the
  // owner's ask): the names are in the privacy policy (public/privacy.html).
  assert.ok(words.includes('ai services'), 'says AI services read parts of them');
  for (const name of ['huggingface', 'groq', 'ocr.space', 'supabase', 'posthog', 'razorpay']) {
    assert.ok(!words.includes(name), `names "${name}"`);
  }
  assert.ok(AGREEMENT_POINTS.every((p) => p.text.length <= 200), 'each point stays short');
});

await test('Claude takes rag-search\'s Groq requests, and its replies read as Groq\'s', () => {
  // System text becomes one field; temperature, which the current API
  // version refuses, is never sent; history opening with the assistant
  // loses that turn, since the first message must be the user's.
  const req = toClaudeRequest({
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: 'Rule one.' },
      { role: 'assistant', content: 'Earlier answer with no question.' },
      { role: 'user', content: 'Whose passport?' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: 'Asha\'s.' },
      { role: 'system', content: 'Rule two.' },
      { role: 'user', content: 'When does it expire?' },
    ],
  }, 'claude-haiku-5-5');
  assert.equal(req.system, 'Rule one.\n\nRule two.');
  assert.deepEqual(req.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.ok(!('temperature' in req), 'no sampling parameter');
  assert.equal(req.max_tokens, CLAUDE_MIN_MAX_TOKENS, 'room for thinking as well as the answer');
  assert.equal(req.output_config.effort, 'low');
  assert.ok(!req.output_config.format, 'no schema, plain text');
  assert.ok(claudeCanTake(req));
  // JSON steps keep to their schema; one ending with the assistant (a
  // prefill, refused) is never sent.
  const schema = { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false };
  const json = toClaudeRequest({ response_format: { type: 'json_object' }, max_tokens: 9000, messages: [{ role: 'user', content: 'q' }] }, 'm', schema);
  assert.deepEqual(json.output_config.format, { type: 'json_schema', schema });
  assert.equal(json.max_tokens, 9000);
  assert.ok(!claudeCanTake(toClaudeRequest({ messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: '{' }] }, 'm')));
  assert.ok(!claudeCanTake(toClaudeRequest({ messages: [{ role: 'system', content: 'only rules' }] }, 'm')));
  // The answer is the text blocks, not the thinking.
  assert.equal(claudeText([{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: 'It expires ' }, { type: 'text', text: 'on 12/03/2031.' }]), 'It expires on 12/03/2031.');
  // A refusal, nothing, or JSON cut short sends the step to Groq; a written
  // answer that ran long still reads.
  assert.ok(claudeUsable('end_turn', 'Fine.', false));
  assert.ok(claudeUsable('max_tokens', 'A long answer', false));
  assert.ok(!claudeUsable('max_tokens', '{"scores":[{"i":0', true));
  assert.ok(!claudeUsable('refusal', 'No.', false));
  assert.ok(!claudeUsable('end_turn', '', false));
  const reply = groqStyleReply('{"query":"Asha passport expiry"}', 'end_turn', { input_tokens: 120, output_tokens: 9 });
  assert.equal(reply.choices[0].message.content, '{"query":"Asha passport expiry"}');
  assert.equal(reply.choices[0].finish_reason, 'stop');
  assert.deepEqual(reply.usage, { prompt_tokens: 120, completion_tokens: 9 });
  // No key, no credit or no such model: Groq answers for a while. A rate
  // limit or a passing fault: Claude is asked again next time.
  for (const s of [400, 401, 402, 403, 404]) assert.ok(claudeShouldRest(s), `${s} rests`);
  for (const s of [undefined, 413, 429, 500, 529]) assert.ok(!claudeShouldRest(s), `${s} does not rest`);
});

await test('search vectors: who makes them, at 384 numbers, inside the CPU budget', async () => {
  // gte-small unless Cloudflare's two secrets are set; HuggingFace only by name;
  // Cloudflare asked for without its secrets is gte-small, never nothing.
  assert.equal(chooseEmbeddingProvider({}), 'gte-small');
  assert.equal(chooseEmbeddingProvider({ CLOUDFLARE_ACCOUNT_ID: 'acc' }), 'gte-small');
  assert.equal(chooseEmbeddingProvider({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_AI_TOKEN: 'tok' }), 'cloudflare');
  assert.equal(chooseEmbeddingProvider({ CLOUDFLARE_ACCOUNT_ID: ' ', CLOUDFLARE_AI_TOKEN: 'tok' }), 'gte-small');
  assert.equal(chooseEmbeddingProvider({ EMBEDDING_PROVIDER: 'huggingface' }), 'huggingface');
  assert.equal(chooseEmbeddingProvider({ EMBEDDING_PROVIDER: 'gte-small', CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_AI_TOKEN: 't' }), 'gte-small');
  assert.equal(chooseEmbeddingProvider({ EMBEDDING_PROVIDER: 'cloudflare' }), 'gte-small');
  // The id an index records names provider, model and size, so changing any
  // of them makes every index stale; HuggingFace keeps the id it always had,
  // which is also what a vault with no row was made on.
  assert.equal(embeddingModelId('gte-small'), GTE_SMALL_MODEL_ID);
  assert.equal(embeddingModelId('cloudflare'), `cloudflare/${CLOUDFLARE_DEFAULT_MODEL}@384`);
  assert.equal(embeddingModelId('cloudflare', { CLOUDFLARE_EMBEDDING_MODEL: '@cf/google/embeddinggemma-300m' }), 'cloudflare/@cf/google/embeddinggemma-300m@384');
  assert.equal(embeddingModelId('huggingface'), HUGGINGFACE_MODEL);
  assert.equal(UNRECORDED_MODEL, HUGGINGFACE_MODEL);
  assert.notEqual(embeddingModelId('gte-small'), UNRECORDED_MODEL, 'gte-small rebuilds every vault without a row');
  // Qwen3 names questions and passages apart, with a task line on questions.
  assert.deepEqual(cloudflareBody(CLOUDFLARE_DEFAULT_MODEL, 'query', ['q']), { queries: ['q'], instruction: QUERY_INSTRUCTION });
  assert.deepEqual(cloudflareBody(CLOUDFLARE_DEFAULT_MODEL, 'passage', ['p']), { documents: ['p'] });
  assert.deepEqual(cloudflareBody('@cf/google/embeddinggemma-300m', 'passage', ['p']), { text: ['title: none | text: p'] });
  assert.deepEqual(cloudflareBody('@cf/google/embeddinggemma-300m', 'query', ['q']), { text: ['task: search result | query: q'] });
  // One more try after Cloudflare's own fault or "try again", never after
  // the day's allowance is used up or a request it refuses.
  assert.equal(cloudflareRetryable(503, '{"errors":[{"message":"AiError: AiError: Unknown internal error (7e12aaf4)","code":3048}],"success":false}'), true, "PROD's 503 of 27 October");
  assert.equal(cloudflareRetryable(500, ''), true);
  assert.equal(cloudflareRetryable(429, '{"errors":[{"message":"Capacity temporarily exceeded, please try again.","code":3040}]}'), true, 'out of capacity');
  assert.equal(cloudflareRetryable(429, '{"errors":[{"message":"You have used up your daily free allocation of 10,000 neurons.","code":3036}]}'), false, 'day used up');
  assert.equal(cloudflareRetryable(400, '{"errors":[{"code":5007}]}'), false);
  assert.equal(cloudflareRetryable(401, ''), false);
  assert.equal(cloudflareRetryable(403, '{"errors":[{"code":3023}]}'), false);
  // Matryoshka: the first 384 of 1,024, scaled back to length 1.
  const long = Array.from({ length: 1024 }, (_, i) => (i < EMBEDDING_DIMS ? 2 : 100));
  const cut = truncateAndNormalise(long);
  assert.equal(cut.length, EMBEDDING_DIMS);
  assert.ok(Math.abs(Math.hypot(...cut) - 1) < 1e-9, 'unit length');
  assert.ok(cut.every((v) => Math.abs(v - 1 / Math.sqrt(EMBEDDING_DIMS)) < 1e-12), 'only the head counts');
  assert.equal(truncateAndNormalise(Array(100).fill(1)), null, 'too short');
  assert.equal(truncateAndNormalise([...Array(383).fill(1), 'x']), null, 'not numbers');
  assert.equal(truncateAndNormalise('nope'), null);
  // The budget: always the first, then only while the average says the next
  // fits; nothing at all with no budget. A fake clock, 150 ms a passage.
  let clock = 0;
  const work = async (x) => { clock += 150; return x * 2; };
  const now = () => clock;
  const r1 = await runWithinBudget([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], work, 1000, now);
  assert.equal(r1.attempted, 6, '150 ms each: six fit in 1,000 ms (the seventh would make 1,050)');
  assert.deepEqual(r1.results, [2, 4, 6, 8, 10, 12, null, null, null, null]);
  assert.equal(r1.spentMs, 900);
  clock = 0;
  const r2 = await runWithinBudget([1, 2], work, 50, now);
  assert.equal(r2.attempted, 1, 'the first always, so every call makes progress');
  const r3 = await runWithinBudget([1, 2], work, 0, now);
  assert.equal(r3.attempted, 0, 'no budget, nothing tried');
  clock = 0;
  const r4 = await runWithinBudget([1, 2, 3], async (x) => { clock += 10; if (x === 2) throw new Error('bad'); return x; }, Number.POSITIVE_INFINITY, now);
  assert.deepEqual(r4.results, [1, null, 3], 'one failure is null, the rest go on');
  assert.equal(r4.attempted, 3);
});

await test('the privacy policy names who gets document text and promises nothing AskLocker does not keep', () => {
  // public/privacy.html is the policy Settings › Privacy links to, at
  // asklocker.com/privacy. The screen names no service; the policy must name
  // every one that gets document text or personal details (CLAUDE.md).
  const html = readFileSync(new URL('../../public/privacy.html', import.meta.url), 'utf8');
  const page = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const words = page.toLowerCase();
  for (const name of ['Supabase', 'Cloudflare', 'Anthropic', 'Groq', 'OCR.space', 'Google', 'Razorpay']) {
    assert.ok(page.includes(name), `names ${name}`);
  }
  assert.ok(words.includes('not end-to-end'), 'says documents are not end-to-end encrypted');
  assert.ok(words.includes('the people who run asklocker can open them'), 'says the people who run AskLocker can open documents');
  for (const claim of ['100% private', 'only you can see', 'nothing is kept', 'secure', 'bank-level', 'military-grade']) {
    assert.ok(!words.includes(claim), `promises "${claim}"`);
  }
  // The usage analytics service is described, not named (the owner's ask).
  assert.ok(!words.includes('posthog'), 'names the analytics service');
  assert.ok(words.includes('turn it off in settings › privacy'), 'says how to turn usage counts off');
  assert.ok(page.includes(`removed after ${DEFAULT_PLAN_LIMITS.graceDays} days`), 'the days before documents go follow the plan limits');
  assert.ok(/Last updated \d{1,2} [A-Z][a-z]+ \d{4}/.test(page), 'carries the date it last changed');
});

if (failures.length) {
  console.error(failures.map((f) => `✗ ${f}`).join('\n'));
  console.error(`\n${failures.length} self-test(s) failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✓ ${passed} self-tests passed — matchers, judge, run-time PDF, metadata, ticket codes, text cleaning, Gmail rules and token sealing, kinship and the family tree, emergency card checks, web push, plan limits, questions each month, limits against abuse, business papers, categories and plan words, Razorpay signatures, numbers in digits, sources the answer used, Claude's requests in Groq's shape, search-vector providers and budget, the agreement's words, the privacy policy, questions and budget.`);
