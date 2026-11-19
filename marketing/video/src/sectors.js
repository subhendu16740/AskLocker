// Professions that live on paper: a short, two posters and a pamphlet each,
// for business marketing (tools/sectors.sh). Plain data, so the films
// (src/features.js, ?film=features&feature=sector-<key>) and the pamphlets
// (tools/pamphlets.mjs, in Node) read the same words.
//
// Every claim is something a business vault does today (CLAUDE.md, Business
// vaults): photos, PDFs and Excel read when added; Ask answers from the
// vault's own papers with the document it came from; the team joins by
// invitation; one document goes out by link; a paper's "Valid up to" date
// becomes an expiry date, and renewals and reminders come with a paid plan
// (★). Never more privacy than AskLocker gives: "Sent and stored encrypted.
// In AskLocker, only your team can open them." Never "secure" or "safe".
//
// Every firm, person, case, vehicle and amount is fictional. A clinic keeps
// its own registrations, licences and bills here; the words never suggest
// patients' medical records.
//
// why / how: the short's two lines (*stars* for emphasis, ~ a space that never
// breaks). head / line: the posters'. q / a / src: the question asked in Ask,
// its answer (<mark> on the fact) and the document it came from. callout: what
// the short and poster list beside the phone. end: the end card's line.
// pamphlet: the printed page's own words.
export const SECTORS = {
  lawyers: {
    name: 'Lawyers', badge: 'For lawyers', icon: 'book-open',
    why: 'The client is on the phone. *The order is in some~file.*',
    how: 'Ask your case papers. Get the answer and its source.',
    head: 'Ask your case papers *anything.*',
    line: 'Orders, notices and agreements, answered in plain words, with the document it came from.',
    q: 'When is the next hearing in Mehra v. Kapoor, and what for?',
    a: 'The order of 12 November 2026 lists Mehra v. Kapoor on <mark class="hl" id="ask-hl">14 January 2027</mark>, for arguments on the stay application.',
    src: 'Order_Mehra_v_Kapoor_12-11-2026.pdf',
    callout: { icon: 'briefcase', label: 'One place for the practice', items: [
      ['Orders, judgments and notices', 'file-text'], ['Vakalatnamas and client papers', 'paperclip'],
      ['Agreements and drafts, PDF or photo', 'camera'], ['Juniors and clerks, by invitation', 'user-check']] },
    end: 'Every order, notice and agreement. One question away.',
    pamphlet: {
      head: 'Ask your case papers anything.',
      sub: 'Every order, notice and agreement in one place. Ask in plain words and get the answer, with the document it came from.',
      keeps: ['Court orders and judgments', 'Notices and replies', 'Vakalatnamas', 'Agreements and drafts', 'Client papers', 'Bar and office registrations'],
      asks: ['When is the next hearing in Mehra v. Kapoor?', 'What did the order of 12 November say about the stay?', 'When did we reply to the notice from Sharma & Sons?'],
    },
  },

  'chartered-accountants': {
    name: 'Chartered accountants', badge: 'For CAs', icon: 'percent',
    why: 'Filing season. *Every client sends papers on~WhatsApp.*',
    how: "Keep every client's papers in one place. Just ask.",
    head: "Every client's papers, *one question away.*",
    line: 'Returns, challans and notices, answered in plain words, with the document it came from.',
    q: "When did we file Verma Foods' GSTR-3B for October, and how much tax was paid?",
    a: "Verma Foods' GSTR-3B for October 2026 was filed on <mark class=\"hl\" id=\"ask-hl\">18 November 2026</mark>, with ₹42,300 paid through the cash ledger.",
    src: 'GSTR3B_VermaFoods_Oct2026.pdf',
    callout: { icon: 'users', label: 'For every client', items: [
      ['GST returns and challans', 'file-text'], ['ITR acknowledgements and Form 16', 'archive'],
      ['Notices and replies', 'mail'], ['Your team and articles, by invitation', 'user-check']] },
    end: "Every client's returns and papers. One question away.",
    pamphlet: {
      head: "Every client's papers, one question away.",
      sub: 'Returns, challans, notices and certificates in one place, read the moment they are added. Ask in plain words and get the answer, with its source.',
      keeps: ['GST returns and challans', 'ITR acknowledgements', 'Form 16 and TDS certificates', 'Notices and replies', 'Audit and bank papers', 'Clients’ invoices and bills, Excel too'],
      asks: ["When did we file Verma Foods' GSTR-3B for October?", "What TDS was deducted in Anil Rao's Form 16?", "What was Rao Traders' turnover in last year's return?"],
    },
  },

  clinics: {
    name: 'Clinics', badge: 'For clinics', icon: 'activity',
    why: 'Registrations, licences, renewals: *each with its own~date.*',
    how: 'Ask when it runs out. Get reminded before it does.',
    head: 'Every licence and renewal, *one question away.*',
    line: "Your clinic's registrations, licences and bills, with reminders before anything lapses.",
    q: 'When does our clinic registration need renewing?',
    a: "Sunrise Clinic's registration certificate is valid up to <mark class=\"hl\" id=\"ask-hl\">31 March 2027</mark>. It was issued on 1 April 2022.",
    src: 'Clinic_Registration_Certificate.pdf',
    callout: { icon: 'bell', label: 'Kept, and reminded', items: [
      ['Registrations and licences', 'award'], ['Insurance and service contracts', 'umbrella'],
      ['Supplier bills and GST', 'file-text'], ['Reminders 90, 30 and 7 days before ★', 'bell']] },
    end: 'Every licence, renewal and bill. One question away.',
    pamphlet: {
      head: 'Every licence and renewal, one question away.',
      sub: "Your clinic's registrations, licences, contracts and bills in one place, with a reminder before anything lapses.",
      keeps: ['Clinic registration', 'Licences and authorisations', 'Fire and pollution NOCs', 'Equipment service contracts', 'Insurance policies', 'Supplier bills and GST'],
      asks: ['When does our clinic registration need renewing?', 'What is the sum insured on our clinic insurance?', 'When is the X-ray machine due for service?'],
    },
  },

  'real-estate': {
    name: 'Real estate', badge: 'For real estate', icon: 'home',
    why: 'Deeds, rent agreements, NOCs: *every property has a~pile.*',
    how: 'Ask about any property. Get the answer and its source.',
    head: 'Every property paper, *one question away.*',
    line: 'Deeds, agreements and NOCs, answered in plain words, with the document it came from.',
    q: 'When does the rent agreement for Flat 304, Green Park end, and what is the rent?',
    a: 'The rent agreement for Flat 304, Green Park Residency runs until <mark class="hl" id="ask-hl">31 May 2027</mark>, at ₹28,000 a month with a ₹1,00,000 deposit.',
    src: 'Rent_Agreement_Flat304_GreenPark.pdf',
    callout: { icon: 'home', label: 'Every property, in one place', items: [
      ['Sale deeds and agreements', 'file-text'], ['Rent agreements and NOCs', 'paperclip'],
      ['Tax receipts and society letters', 'archive'], ['One paper by link, not the whole vault', 'link']] },
    end: 'Every deed, agreement and NOC. One question away.',
    pamphlet: {
      head: 'Every property paper, one question away.',
      sub: 'Deeds, agreements, NOCs and receipts for every property in one place. Ask in plain words, and send a buyer or tenant just the paper they need.',
      keeps: ['Sale deeds', 'Agreements to sell', 'Rent agreements', 'NOCs and approvals', 'Property tax receipts', 'Society and builder letters'],
      asks: ['When does the rent agreement for Flat 304 end?', 'What is the deposit on the Green Park flat?', 'Do we have the society NOC for Shop 12?'],
    },
  },

  'insurance-advisors': {
    name: 'Insurance advisors', badge: 'For insurance advisors', icon: 'umbrella',
    why: 'A client calls about a claim. *Their policy is in your~inbox.*',
    how: "Ask about any client's policy. Get the answer and its source.",
    head: "Every client's policy, *one question away.*",
    line: 'Policies, renewals and claim papers, with every renewal coming up at a glance.',
    q: "What is the sum insured on Ramesh Rao's health policy, and when does it renew?",
    a: "Ramesh Rao's family floater with Arogya Shield has a sum insured of ₹10,00,000 and renews on <mark class=\"hl\" id=\"ask-hl\">14 March 2027</mark>.",
    src: 'Policy_ArogyaShield_RameshRao.pdf',
    callout: { icon: 'umbrella', label: 'Every client, every renewal', items: [
      ["Clients' policies, PDF or photo", 'file-text'], ['Renewals in the next 90 days ★', 'calendar'],
      ['Claim papers and endorsements', 'paperclip'], ['One policy by link', 'link']] },
    end: "Every client's policy and renewal. One question away.",
    pamphlet: {
      head: "Every client's policy, one question away.",
      sub: "Your clients' policies, renewals and claim papers in one place. Ask in plain words, and see every renewal coming up.",
      keeps: ['Health and life policies', 'Motor and home policies', 'Renewal notices', 'Claim papers', 'Endorsements', 'Proposal forms'],
      asks: ["What is the sum insured on Ramesh Rao's health policy?", "What is the IDV on Priya Shah's car policy?", "Who is the nominee on Sunita Rao's term plan?"],
    },
  },

  transport: {
    name: 'Transport', badge: 'For transport', icon: 'truck',
    why: 'Insurance, permit, fitness, PUC: *every truck has four~dates.*',
    how: 'Ask when it runs out. Get reminded before it does.',
    head: 'Every vehicle paper, *one question away.*',
    line: 'RCs, permits, insurance and PUC, with reminders before anything lapses.',
    q: 'When does the fitness certificate for MH-12-XY-4821 expire?',
    a: 'The fitness certificate for MH-12-XY-4821 is valid up to <mark class="hl" id="ask-hl">9 February 2027</mark>. It was issued by RTO Pune on 10 February 2025.',
    src: 'Fitness_MH12XY4821.pdf',
    callout: { icon: 'truck', label: 'Every vehicle, every date', items: [
      ['RC, permit and fitness', 'file-text'], ['Insurance and PUC', 'umbrella'],
      ["Drivers' licences", 'user-check'], ['Reminders 90, 30 and 7 days before ★', 'bell']] },
    end: 'Every RC, permit and renewal. One question away.',
    pamphlet: {
      head: 'Every vehicle paper, one question away.',
      sub: 'RCs, permits, fitness, insurance and PUC for every vehicle in one place, with a reminder before anything lapses.',
      keeps: ['Registration certificates', 'Permits', 'Fitness certificates', 'Insurance', 'PUC certificates', "Drivers' licences"],
      asks: ['When does the fitness for MH-12-XY-4821 expire?', 'When is the permit for MH-12-XY-4821 due for renewal?', "When does Raju's driving licence run out?"],
    },
  },
};

// What every pamphlet says beside the sector's own words (CLAUDE.md, Business
// vaults; the prices from supabase/functions/_shared/plan-text.ts).
export const PAMPHLET = {
  steps: [
    ['camera', 'Snap or upload', 'Photos, PDFs and Excel sheets, read the moment you add them.'],
    ['message-circle', 'Ask', 'In plain words. The answer comes from your own papers, with the document it came from.'],
    ['users', 'Bring your team', 'Partners, staff and your CA join by invitation.'],
  ],
  also: [
    ['bell', 'Reminders before a licence or policy runs out', true],
    ['bar-chart-2', 'Renewals and bills due at a glance', true],
    ['link', 'Send one document by link, not the whole vault', false],
    ['mic', 'Ask by voice, in Hindi and 9 more languages', false],
  ],
  privacy: 'Sent and stored encrypted. In AskLocker, only your team can open them.',
  plans: 'Free to start · Plans from ₹499 a month + GST',
  url: 'asklocker.com',
};

/** Where a pamphlet's QR code goes: the home page, marked with where it came from. */
export const pamphletUrl = (key) => `https://asklocker.com/?utm_source=pamphlet&utm_campaign=${key}`;
