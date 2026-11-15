import * as audio from './audio.js';

const body = document.body;
const video = document.getElementById('bgv');
const bg = document.getElementById('bg');
const hero = document.querySelector('.hero');
const loader = document.getElementById('loader');
const go = document.getElementById('go');
const sound = document.getElementById('sound');
const topBar = document.getElementById('top-bar');
const scrub = document.getElementById('scrub');
const ritual = document.getElementById('ritual');
const thread = document.getElementById('thread');
const chaps = [...document.querySelectorAll('.chap')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* sound */
sound.addEventListener('click', () => {
  const on = audio.toggle();
  if (on === null) return;
  sound.setAttribute('aria-pressed', String(on));
});

/* loader: lift once the first video frame is ready, or after 1.6s whichever comes first */
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

/* story: split into words so each can light up with scroll */
const words = [];
if (scrub) {
  scrub.querySelectorAll('.sl').forEach((line) => {
    const text = line.textContent.trim();
    line.textContent = '';
    text.split(/(\s+)/).forEach((tok) => {
      if (/^\s+$/.test(tok)) {
        line.appendChild(document.createTextNode(' '));
        return;
      }
      const sp = document.createElement('span');
      sp.className = 'w';
      sp.textContent = tok;
      line.appendChild(sp);
      words.push(sp);
    });
  });
}

/* one-shot reveals: chapters and the set section, with price count-up */
const fmt = (n) => n.toLocaleString('vi-VN');
function countUp(el) {
  const to = Number(el.dataset.to);
  if (!to || reduced) { el.textContent = fmt(to || 0); return; }
  const t0 = performance.now();
  const dur = 1600;
  const tick = (now) => {
    const k = clamp((now - t0) / dur);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('.count').forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.35 });
document.querySelectorAll('.chap, .set').forEach((el) => io.observe(el));

/* scroll-driven: video dim, hero fade, word light, thread growth, header hide */
let lastY = scrollY;
function onScroll() {
  const vh = innerHeight;
  const y = scrollY;

  const t = clamp(y / (vh * 0.9));
  bg.style.setProperty('--dim', (t * 0.4).toFixed(3));
  bg.style.setProperty('--blur', (t * 16).toFixed(1) + 'px');
  hero.style.opacity = String(Math.max(0, 1 - t * 1.5));

  if (words.length && !reduced) {
    const r = scrub.getBoundingClientRect();
    const p = clamp((vh * 0.78 - r.top) / (r.height + vh * 0.28));
    const lit = p * (words.length + 6);
    words.forEach((w, i) => {
      w.style.opacity = (0.16 + 0.84 * clamp(lit - i)).toFixed(2);
    });
  } else if (words.length) {
    words.forEach((w) => { w.style.opacity = '1'; });
  }

  if (thread) {
    const r = ritual.getBoundingClientRect();
    thread.style.setProperty('--p', clamp((vh * 0.6 - r.top) / r.height).toFixed(3));
  }

  if (!reduced && innerWidth > 820) {
    chaps.forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1);
      c.querySelector('.art').style.transform = `translate3d(0,${(d * -70).toFixed(1)}px,0)`;
      c.querySelector('.txt').style.transform = `translate3d(0,${(d * 26).toFixed(1)}px,0)`;
    });
  }

  const down = y > lastY + 4;
  const up = y < lastY - 4;
  if (y > vh * 0.6 && down) topBar.classList.add('hide');
  else if (up || y <= vh * 0.6) topBar.classList.remove('hide');
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* mouse parallax: video drifts a few px against the cursor */
let tx = 0, ty = 0, cx = 0, cy = 0;
if (!reduced) {
  addEventListener('pointermove', (e) => {
    tx = -((e.clientX / innerWidth) * 2 - 1) * 14;
    ty = -((e.clientY / innerHeight) * 2 - 1) * 9;
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
  video.style.setProperty('--px', cx.toFixed(2) + 'px');
  video.style.setProperty('--py', cy.toFixed(2) + 'px');
  const r = video.playbackRate + (rateTarget - video.playbackRate) * 0.05;
  if (Math.abs(r - video.playbackRate) > 0.002) video.playbackRate = r;
}
frame();
