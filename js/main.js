import * as audio from './audio.js';

const body = document.body;
const video = document.getElementById('bgv');
const bg = document.getElementById('bg');
const loader = document.getElementById('loader');
const go = document.getElementById('go');
const sound = document.getElementById('sound');
const scrub = document.getElementById('scrub');
const root = document.documentElement;
const screens = [...document.querySelectorAll('.screen')];
const railBtns = [...document.querySelectorAll('.rail button')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* sound */
sound.addEventListener('click', () => {
  const on = audio.toggle();
  if (on === null) return;
  sound.setAttribute('aria-pressed', String(on));
});

/* loader */
let revealed = false;
const reveal = () => {
  if (revealed) return;
  revealed = true;
  loader.classList.add('gone');
  setTimeout(() => body.classList.add('ready'), 250);
};
if (video.readyState >= 2) reveal();
video.addEventListener('loadeddata', reveal, { once: true });
setTimeout(reveal, 1600);

if (reduced) {
  video.removeAttribute('autoplay');
  video.pause();
} else {
  const p = video.play();
  if (p && p.catch) p.catch(() => {});
}

/* story words: index each one so they light up in reading order when the screen opens */
if (scrub) {
  let n = 0;
  scrub.querySelectorAll('.sl').forEach((line) => {
    const text = line.textContent.trim();
    line.textContent = '';
    text.split(/(\s+)/).forEach((tok) => {
      if (/^\s+$/.test(tok)) { line.appendChild(document.createTextNode(' ')); return; }
      const sp = document.createElement('span');
      sp.className = 'w';
      sp.style.setProperty('--n', n++);
      sp.textContent = tok;
      line.appendChild(sp);
    });
  });
}

/* price count-up */
const fmt = (v) => v.toLocaleString('vi-VN');
function countUp(el) {
  const to = Number(el.dataset.to);
  if (!to) return;
  if (reduced) { el.textContent = fmt(to); return; }
  el.textContent = '0';
  const t0 = performance.now() + 700;
  const tick = (now) => {
    const k = clamp((now - t0) / 1600);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* screen engine */
let cur = -1;
let locked = false;
const leaveTimers = new Map();
const idIndex = (id) => screens.findIndex((s) => s.dataset.id === id);

function mark(el, on) {
  el.classList.toggle('in', on);
  const chap = el.querySelector('.chap');
  if (chap) chap.classList.toggle('in', on);
}

function show(i, { push = true } = {}) {
  i = clamp(i, 0, screens.length - 1);
  if (i === cur) return;
  const prev = cur;
  cur = i;
  screens.forEach((s, k) => {
    s.classList.toggle('active', k === i);
    s.classList.toggle('past', k < i);
    s.classList.toggle('next', k > i);
    s.setAttribute('aria-hidden', String(k !== i));
  });
  const el = screens[i];
  el.scrollTop = 0;
  clearTimeout(leaveTimers.get(el));
  mark(el, true);
  el.querySelectorAll('.count').forEach(countUp);
  if (prev >= 0) {
    const old = screens[prev];
    leaveTimers.set(old, setTimeout(() => { if (screens[cur] !== old) mark(old, false); }, 1300));
  }
  bg.style.setProperty('--blur', (el.dataset.blur || 0) + 'px');
  bg.style.setProperty('--dim', el.dataset.dim || 0);
  railBtns.forEach((b) => b.classList.toggle('on', b.dataset.go === el.dataset.id));
  if (push) {
    const h = el.dataset.id === 'top' ? location.pathname + location.search : '#' + el.dataset.id;
    history.pushState({ i }, '', h);
  }
  locked = true;
  setTimeout(() => { locked = false; }, reduced ? 100 : 1250);
}
const next = () => show(cur + 1);
const prevScreen = () => show(cur - 1);

/* can the active screen still scroll inside itself? (small windows, phones) */
function canScroll(dir) {
  const s = screens[cur];
  if (s.scrollHeight <= s.clientHeight + 2) return false;
  return dir > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 2;
}

addEventListener('wheel', (e) => {
  const dir = Math.sign(e.deltaY);
  if (!dir || Math.abs(e.deltaY) < 8) return;
  if (canScroll(dir)) return;
  e.preventDefault();
  if (locked) return;
  dir > 0 ? next() : prevScreen();
}, { passive: false });

addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  const k = e.key;
  if (['ArrowDown', 'PageDown', ' '].includes(k)) { e.preventDefault(); if (!locked) next(); }
  else if (['ArrowUp', 'PageUp'].includes(k)) { e.preventDefault(); if (!locked) prevScreen(); }
  else if (k === 'Home') { e.preventDefault(); show(0); }
  else if (k === 'End') { e.preventDefault(); show(screens.length - 1); }
});

let ty0 = null;
addEventListener('touchstart', (e) => { ty0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => {
  if (ty0 === null) return;
  const dy = ty0 - e.changedTouches[0].clientY;
  ty0 = null;
  if (Math.abs(dy) < 50 || locked) return;
  if (canScroll(Math.sign(dy))) return;
  dy > 0 ? next() : prevScreen();
}, { passive: true });

/* links, rail and back button */
document.querySelectorAll('a[href^="#"]:not([href="#"]), .rail button').forEach((el) => {
  el.addEventListener('click', (e) => {
    const id = el.dataset.go || (el.getAttribute('href') || '').slice(1);
    const i = idIndex(id === 'ritual' ? 'mind' : id || 'top');
    if (i < 0) return;
    e.preventDefault();
    show(i);
  });
});
addEventListener('popstate', () => {
  const id = location.hash.slice(1) || 'top';
  const i = idIndex(id === 'ritual' ? 'mind' : id);
  if (i >= 0) show(i, { push: false });
});
const start = idIndex((location.hash.slice(1) === 'ritual' ? 'mind' : location.hash.slice(1)) || 'top');
show(start < 0 ? 0 : start, { push: false });

/* mouse: video drifts, art and text shift on different planes for depth */
let tx = 0, ty = 0, cx = 0, cy = 0;
if (!reduced) {
  addEventListener('pointermove', (e) => {
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  });
}

/* hovering the arrow slows the wind and muffles the sound */
let rateTarget = 1;
go.addEventListener('pointerenter', () => { rateTarget = 0.4; audio.setMuffled(true); });
go.addEventListener('pointerleave', () => { rateTarget = 1; audio.setMuffled(false); });

function frame() {
  requestAnimationFrame(frame);
  cx += (tx - cx) * 0.06;
  cy += (ty - cy) * 0.06;
  video.style.setProperty('--px', (-cx * 14).toFixed(2) + 'px');
  video.style.setProperty('--py', (-cy * 9).toFixed(2) + 'px');
  root.style.setProperty('--mx', cx.toFixed(3));
  root.style.setProperty('--my', cy.toFixed(3));
  const r = video.playbackRate + (rateTarget - video.playbackRate) * 0.05;
  if (Math.abs(r - video.playbackRate) > 0.002) video.playbackRate = r;
}
frame();
