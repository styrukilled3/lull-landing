import * as audio from './audio.js';

const body = document.body;
const video = document.getElementById('bgv');
const bg = document.getElementById('bg');
const shade = document.getElementById('shade');
const hero = document.querySelector('.hero');
const loader = document.getElementById('loader');
const go = document.getElementById('go');
const sound = document.getElementById('sound');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* section reveal */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

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

/* scroll: video darkens and hero fades, so the Ritual sections read cleanly */
let dim = 0;
const onScroll = () => {
  const t = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
  dim = t;
  bg.style.setProperty('--dim', (t * 0.82).toFixed(3));
  hero.style.opacity = String(Math.max(0, 1 - t * 1.5));
};
addEventListener('scroll', onScroll, { passive: true });
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
  void dim;
}
frame();
