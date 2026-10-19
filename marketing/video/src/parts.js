// The pieces both films build their screens from: the phone's own screens
// (lock screen, calls, camera), the app's chrome (top bar, tab bar, avatars,
// chips, the Ask screen's parts) and the film's text blocks. Every app part is
// a port of the real component in src/app/** or src/components/**, sized by
// src/constants/design.ts.
import { icon } from './icons.js';

export { icon };

// The app's colours: the family's (design.ts's color) and a business's (biz).
// In Business mode the top bar, the drawer, the tab bar and most buttons wear
// teal; the chat bubbles, Upload's category chips and a few others stay navy,
// as the app has them (src/lib/vault-theme.ts).
export const THEME = {
  family: { primary: '#2A3D66', secondary: '#4A6491', tint: '#EFF6FF' },
  business: { primary: '#0F5C57', secondary: '#1A7A72', tint: '#E7F4F2' },
};

export function logoMark() {
  // The app's icon (public/icon-512.png): a locker with a speech bubble. The
  // shapes are assets/expo.icon/Assets/asklocker-mark.svg, placed, weighted
  // and coloured as the icon has them (it matches the PNG pixel for pixel):
  // the bubble coral, ringed in the tile's navy where it crosses the locker,
  // its "?" white (Liberation Sans Bold, as a path, so the mark needs no font).
  // .lm-bubble lets the reveal pop the bubble in.
  return `<svg viewBox="0 0 1024 1024" aria-hidden="true"><g transform="translate(-30 20)">
    <g fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
      <rect x="300" y="236" width="330" height="588" rx="54"/><path d="M382 340H548M382 412H548M568 560V650"/></g>
    <circle cx="465" cy="640" r="30" fill="#fff"/>
    <g class="lm-bubble">
      <path d="M708 150h118a86 86 0 0 1 86 86v96a86 86 0 0 1-86 86h-82l-74 64v-64a86 86 0 0 1-48-78v-104a86 86 0 0 1 86-86z"
        fill="#D4807B" stroke="#2A3D66" stroke-width="28" stroke-linejoin="round"/>
      <path fill="#fff" d="M809.6 233.8Q809.6 243.3 805.3 250.8Q801.1 258.3 789.4 266.6L782 272Q775.4 276.8 772.1 281.7Q768.8 286.5 768.5 292.4H742.5Q743.1 282.4 748.1 274.6Q753.1 266.8 762.9 260Q773.3 252.8 777.6 247.2Q781.9 241.7 781.9 235Q781.9 226.4 776.3 221.4Q770.7 216.4 760.3 216.4Q750.5 216.4 743.8 222.2Q737.1 227.9 735.9 237.4L708.1 236.2Q710.7 216.4 724.4 205.4Q738.1 194.4 760 194.4Q783.1 194.4 796.3 204.8Q809.6 215.3 809.6 233.8ZM741.7 334V307.6H769.9V334Z"/></g>
  </g></svg>`;
}

export function spinner(color = '#2A3D66', size = 20, cls = '') {
  // ActivityIndicator on the web: a faint track and a short arc. Spun by the timeline.
  return `<svg class="spinner ${cls}" width="${size}" height="${size}" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="4" opacity="0.2"/>
    <circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="80" stroke-dashoffset="60"/></svg>`;
}

function signalIcon() {
  return `<svg width="17" height="13" viewBox="0 0 17 13" fill="currentColor"><rect x="0" y="9" width="3" height="4" rx="1"/><rect x="4.6" y="6" width="3" height="7" rx="1"/><rect x="9.2" y="3" width="3" height="10" rx="1"/><rect x="13.8" y="0" width="3" height="13" rx="1"/></svg>`;
}

function batteryIcon() {
  return `<svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.75" y="0.75" width="21.5" height="11.5" rx="3.2" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5"/><rect x="2.6" y="2.6" width="15" height="7.8" rx="1.7" fill="currentColor"/><rect x="23.4" y="4" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.45"/></svg>`;
}

// The installed web app: Android paints the status bar in the page's
// theme-color, which is navy in both modes (src/app/_layout.tsx).
export const sbFill = '<div class="sb-fill"></div>';

/** The ★ tag (screen-header.tsx's PlusTag): "Family Plus", or a business plan's name. */
export const plusTag = (name = 'Family Plus') => `<span class="plus-tag"><span class="st">★</span><span class="pl">${name}</span></span>`;
/** The ★ after the name of someone on a paid plan (PlusStar). */
export const plusStar = '<span class="plus-star"> ★</span>';

/** ScreenHeader: the back arrow, the title (and subtitle), at most a little on the right. */
export function header(title, { sub = '', right = '', id = '', theme = 'family' } = {}) {
  return `<div class="v4-bar"${id ? ` id="${id}"` : ''}>
    <span class="v4-back">${icon('arrow-left', 24, THEME[theme].primary)}</span>
    <div class="v4-titles"><div class="v4-title">${title}</div>${sub ? `<div class="v4-sub">${sub}</div>` : ''}</div>
    ${right}</div>`;
}

/** The tab bar ((tabs)/_layout.tsx): Home, the round Ask button, Upload. */
export function tabBar(active, prefix, theme = 'family') {
  const tab = (name, iconName, label) => {
    const c = active === name ? THEME[theme].primary : '#9CA3AF';
    return `<div class="tab" id="${prefix}-tab-${name}" style="color:${c}">${icon(iconName, 22, c)}<span class="tab-label">${label}</span></div>`;
  };
  return `<div class="tabbar">${tab('home', 'home', 'Home')}
    <div class="tab-search"><div class="search-btn ${theme === 'business' ? 'grad-biz' : 'grad'}">${icon('search', 30, '#fff')}</div></div>
    ${tab('upload', 'upload', 'Upload')}</div>`;
}

/** Avatar from family-tree-view.tsx: initials on a gradient, a green phone for an account. */
export function avatar(name, size, { me = false, onApp = false } = {}) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  const b = Math.min(22, Math.max(16, Math.round(size * 0.5)));
  const badge = onApp && size >= 28
    ? `<i class="av-badge" style="width:${b}px;height:${b}px;right:${-0.2 * b}px;bottom:${-0.15 * b}px">${icon('smartphone', Math.round(b * 0.58), '#fff', 2.4)}</i>`
    : '';
  return `<div class="av ${me ? 'me' : ''}" style="width:${size}px;height:${size}px;font-size:${size >= 48 ? 18 : 13}px">${initials}${badge}</div>`;
}

export const words = (text) => text.split(' ').map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(' ');
// Like words(), for a "why" line: *stars* mark the emphasis, | breaks the
// line, and ~ is a space that never breaks.
export const rich = (text) => text.split('|').map((line) => line.split(/(\*[^*]+\*)/).filter((p) => p.trim()).map((part) => {
  const em = part.startsWith('*');
  return part.replace(/\*/g, '').trim().split(/\s+/)
    .map((w) => `<span class="w"><span class="wi${em ? ' em' : ''}">${w.replace(/~/g, ' ')}</span></span>`).join(' ');
}).join(' ')).join('<br>');

// ─── The phone's own screens ─────────────────────────────────────────────

export function lockScreen(id, time, date, notifs) {
  return `<section class="scr scr-lock" id="${id}">
    <div class="lock-wall"></div>
    <div class="lock-clock"><div class="lock-time" id="${id}-time">${time}</div><div class="lock-date">${date}</div></div>
    ${notifs}
    <div class="lock-bottom"><span>${icon('zap', 20, '#fff')}</span><span>${icon('camera', 20, '#fff')}</span></div>
  </section>`;
}

/** A text message on the lock screen; the lines after the first arrive later. */
export function lockNotif(id, from, lines) {
  const [first, ...rest] = lines;
  return `<div class="lnotif" id="${id}">
    <div class="ln-head"><span class="ln-app">${icon('message-circle', 13, '#fff', 2.6)}</span><span>Messages</span><span>•</span><span>now</span></div>
    <div class="ln-body"><div class="ln-avatar">${from[0]}</div><div>
      <div class="ln-title">${from}</div>
      <div class="ln-text">${first}</div>
      ${rest.map((l, i) => `<div class="ln-more" id="${id}-more${i + 1}"><div class="ln-text">${l}</div></div>`).join('')}
    </div></div>
  </div>`;
}

// An AskLocker notification as public/sw.js shows it: the title and body the
// server wrote, the app's icon, the app's name from the manifest.
export function pushNotif(id, title, body) {
  return `<div class="lnotif push" id="${id}">
    <div class="ln-head"><span class="ln-app mark">${logoMark()}</span><span>AskLocker</span><span>•</span><span>now</span></div>
    <div class="ln-title">${title}</div><div class="ln-text">${body}</div>
  </div>`;
}

/** A call: ringing in (decline and answer), or going out (one button to hang up). */
export function callScreen({ label, name, sub, outgoing = false, missed = 'Missed call' }) {
  const actions = outgoing
    ? `<div class="call-actions out" id="call-actions"><div class="call-btn decline">${icon('phone-off', 30, '#fff')}</div></div>`
    : `<div class="call-actions" id="call-actions">
      <div class="call-btn decline">${icon('phone-off', 30, '#fff')}</div>
      <div class="call-btn accept">${icon('phone', 30, '#fff')}</div></div>`;
  return `<section class="scr scr-call" id="scr-call">
    <div class="call-top"><div class="call-label" id="call-label">${label}</div><div class="call-name">${name}</div><div class="call-sub">${sub}</div></div>
    <div class="call-av"><div class="ring" id="ring1"></div><div class="ring" id="ring2"></div><div class="ring" id="ring3"></div><div class="av">${name[0]}</div></div>
    <div class="call-missed" id="call-missed">${icon('phone-missed', 20, '#FF8A8A')}<span>${missed}</span></div>
    ${actions}
  </section>`;
}

export function cameraScreen(paper) {
  return `<section class="scr scr-camera" id="scr-camera">
    <div class="cam-top">${icon('x', 26, '#fff')}${icon('zap', 22, '#fff')}</div>
    <div class="cam-view">
      <div class="grain"></div>
      <div class="cam-doc" id="cam-doc">${paper}</div>
      <div id="cam-guides"><i class="cam-corner tl"></i><i class="cam-corner tr"></i><i class="cam-corner bl"></i><i class="cam-corner br"></i></div>
      <div class="cam-scanline" id="cam-scan"></div>
    </div>
    <div class="cam-modes"><span>VIDEO</span><b>PHOTO</b><span>DOCUMENT</span></div>
    <div class="cam-bottom"><div class="cam-thumb"></div><div class="cam-shutter" id="cam-shutter"><i></i></div><div class="cam-flip">${icon('refresh-cw', 22, '#fff')}</div></div>
  </section>`;
}

/** The phone itself, with the screens the film shows on it. */
export function phoneShell(screens, time) {
  return `<div class="phone" id="phone"><div class="shell">
      <i class="side-btn vol"></i><i class="side-btn power"></i>
      <div class="screen" id="screen">
        ${screens}
        <div class="statusbar" id="sb"><span class="sb-time">${time}</span>
          <span class="sb-icons">${signalIcon()}${icon('wifi', 16, 'currentColor', 2.4)}${batteryIcon()}</span></div>
        <i class="homebar dark" id="hb-dark"></i><i class="homebar light" id="hb-light"></i>
        <div id="shutter"></div>
        <div id="touch"></div>
        <div class="glare"></div>
        <div class="punch"></div>
      </div>
    </div></div>`;
}

// ─── App parts ───────────────────────────────────────────────────────────

// Person chips gain a check mark when selected and category chips do not.
export function chip(id, label, selected, check) {
  return `<div class="chip${check ? ' person' : ''}" id="${id}">${label}
    <div class="sel" id="${id}-sel" style="opacity:${selected ? 1 : 0}">${check ? icon('check', 14, '#fff') : ''}<span>${label}</span></div></div>`;
}

/** Upload's category chips, then the dashed "More…" that opens the rest. */
export function categoryChips(prefix, names, selected = -1) {
  return `<div class="chips">${names.map((c, i) => chip(`${prefix}-${i}`, c, i === selected, false)).join('')}<div class="chip more">More…</div></div>`;
}

/** The OCR card, then what it found (upload.tsx). */
export function ocrSlot(found) {
  return `<div class="ocr-slot">
    <div class="ocr-card" id="ocr-card"><div class="ocr-head">${spinner('#2A3D66', 20, 'ocr-spin')}<span>Reading English text...</span></div>
      <div class="ocr-bar"><div class="ocr-fill" id="ocr-fill"></div></div></div>
    <div class="ocr-done" id="ocr-done">${icon('check-circle', 16, '#16A34A')}<span>Found ${found} characters of text</span></div>
  </div>`;
}

/** The upload's done dialog. */
export function uploadedDialog(vault) {
  return `<div class="overlay" id="up-dialog" style="opacity:0">
    <div class="dialog" id="up-dialog-box">${icon('check-circle', 32, '#22C55E')}
      <div class="t">Uploaded!</div><div class="m">Saved to ${vault}.</div>
      <div class="btns"><div class="b o">View</div><div class="b f">Done</div></div></div>
  </div>`;
}

export function askMessages(prefix, turns, voice) {
  // Each turn: a user bubble, a loading bubble and the answer bubble. They are
  // absolutely positioned by the timeline (see layoutChat in engine.js). A
  // source chip names its vault when the mode has more than one.
  return turns.map((t, i) => `
    <div class="msg user" id="${prefix}-q${i + 1}"><div class="bubble">${t.q}</div></div>
    <div class="msg ai" id="${prefix}-l${i + 1}"><div class="ai-avatar">${icon('cpu', 14, '#2A3D66')}</div>
      <div class="bubble"><div class="typing">${spinner('#2A3D66', 20, `${prefix}-spin`)}<span>${t.loading}</span></div></div></div>
    <div class="msg ai" id="${prefix}-a${i + 1}"><div class="ai-avatar">${icon('cpu', 14, '#2A3D66')}</div>
      <div class="bubble"><div>${t.a}</div>
        ${voice ? `<div class="voice-tools"><div class="vt-btn" id="${prefix}-stop${i + 1}">${icon('square', 14, '#2A3D66')}<span>${t.stop}</span></div>
          <div class="vt-btn" id="${prefix}-again${i + 1}" style="opacity:0">${icon('volume-2', 14, '#2A3D66')}<span>${t.again}</span></div></div>` : ''}
        <div class="sources"><div class="src-chip">${icon('file-text', 12, '#2A3D66')}<span>${t.src}</span>${t.vault ? `<span class="src-vault">· ${t.vault}</span>` : ''}</div></div>
      </div></div>`).join('');
}

export function askHeader(prefix, theme = 'family') {
  // New question appears once there are messages; the Saved chats clock never moves.
  const c = THEME[theme].primary;
  return header('Ask', { theme, right: `<div class="v4-actions">
    <span class="v4-iconbtn" id="${prefix}-new" style="opacity:0">${icon('plus', 24, c)}</span>
    <span class="v4-iconbtn" id="${prefix}-clock">${icon('clock', 24, c)}</span></div>` });
}

/** Ask's "Search in" bar, shown when the mode has more than one vault (vault-sheet.tsx). */
export function searchIn(scope) {
  return `<div class="search-in"><div class="si-pill">${icon('layers', 14, '#2A3D66')}<span class="si-t"><span class="si-l">Search in </span><b>${scope}</b></span>${icon('chevron-down', 14, '#2A3D66')}</div></div>`;
}

export function saveBar(prefix) {
  return `<div class="savebar" id="${prefix}-savebar" style="opacity:0">
    <div class="save-pill" id="${prefix}-save">${icon('bookmark', 16, '#2A3D66')}<span>Save chat</span>
      <div class="saved" id="${prefix}-saved" style="opacity:0">${icon('check-circle', 16, '#2F7D5C')}<span>Saved</span></div></div>
    <div class="save-note" id="${prefix}-savenote" style="opacity:0">Saved. Tap the clock at the top to find it.</div>
  </div>`;
}

/** Ask's typed input bar. */
export function askInput(prefix) {
  return `<div class="ask-inputbar"><div class="ask-inputbox">
    <span class="ask-lead">${icon('message-circle', 18, '#9CA3AF')}</span>
    <div class="ask-input"><span class="ask-ph" id="${prefix}-ph">Ask about your documents...</span><span class="ask-line" id="${prefix}-line"><span id="${prefix}-typed"></span><span class="caret" id="${prefix}-caret" style="opacity:0"></span></span></div>
    <div class="send-wrap"><div class="send-btn off" id="${prefix}-send-off">${icon('send', 18, '#fff')}</div>
      <div class="send-btn grad" id="${prefix}-send-on" style="opacity:0">${icon('send', 18, '#fff')}</div></div>
  </div></div>`;
}

// ─── Film text ───────────────────────────────────────────────────────────

/** Every feature scene says why it exists, then how AskLocker answers it. */
export function whyHow(id, kicker, kIcon, why, how, sub, { plus = '', after = '' } = {}) {
  return `<div class="tblock wh" id="${id}">
      <div class="kicker">${icon(kIcon, 22, 'currentColor', 2.4)}<span>${kicker}</span>${plus ? `<span class="k-plus">${plus}</span>` : ''}</div>
      <div class="wh-why"><div class="wh-tag why">Why</div><div class="why-t">${rich(why)}</div></div>
      <div class="wh-how"><div class="wh-tag how">How</div><div class="h1">${words(how)}</div><div class="sub">${sub}</div>${after}</div></div>`;
}

/** The trust scene: why, how, four cards, and the plain words under them. */
export function trustBlock(why, how, cards, note) {
  return `<div id="t-trust">
    <div class="trust-head"><div class="kicker">${icon('shield', 22, 'currentColor', 2.4)}<span>Privacy</span></div>
      <div class="wh-why"><div class="wh-tag why">Why</div><div class="why-t">${rich(why)}</div></div>
      <div class="wh-how"><div class="wh-tag how">How</div><div class="h1">${words(how)}</div></div></div>
    <div class="trust-body"><div class="trust-row">
      ${cards.map(([ic, t, b], i) => `<div class="trust-card" id="tc${i + 1}"><div class="trust-ic">${icon(ic, 30, '#2A3D66')}</div><div class="trust-t">${t}</div><div class="trust-b">${b}</div></div>`).join('')}
    </div>
    <div class="trust-note" id="trust-note">${note}</div></div>
  </div>`;
}

/** The logo, the name and a line under it: the reveal, and the end card with its call to action. */
export function brand(id, tagline, { badge = '', cta = '', ctaNote = '', url = '', end = false } = {}) {
  const p = end ? 'end-' : '';
  return `<div class="brand" id="${id}">
    <div class="logo-tile" id="${end ? 'end-logo' : 'logo'}">${logoMark()}</div>
    <div class="wordmark" id="${end ? 'end-word' : 'wordmark'}">AskLocker</div>
    ${badge ? `<div class="biz-badge" id="${p}badge">${icon('briefcase', 26, '#fff', 2.4)}<span>${badge}</span></div>` : ''}
    <div class="tagline" id="${end ? 'end-tag' : 'tagline'}">${tagline}</div>
    ${cta ? `<div class="cta${badge ? ' biz' : ''}" id="end-cta"><span>${cta}</span>${icon('chevron-right', 26, '#fff', 2.6)}</div>` : ''}
    ${ctaNote ? `<div class="cta-note" id="end-note">${ctaNote}</div>` : ''}
    ${url ? `<div class="cta-url" id="end-url">${url}</div>` : ''}
  </div>`;
}
