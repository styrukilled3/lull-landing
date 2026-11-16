const PRODUCTS = {
  mind: {
    name: 'Túi thơm thảo mộc Mind Off', price: 59000, no: '01 / Mind Off', title: 'Túi thơm thảo mộc', tag: 'Signal to Rest',
    img: 'assets/img/mind.jpg', alt: 'Túi thơm Mind Off màu xanh rêu, thêu logo lull vàng',
    desc: 'Điểm khởi động của nghi thức: dùng hương thơm làm tín hiệu báo thời điểm kết thúc công việc và bắt đầu nghỉ ngơi.',
    facts: ['Thành phần: vỏ sen khô 40% (20g), trần bì 35% (17,5g), hoa cúc khô 25% (12,5g)', 'Khối lượng: 50g', 'Túi cotton, kèm mã QR nghe nhạc thư giãn'],
  },
  eyes: {
    name: 'Kem dưỡng mắt Eyes Off', price: 159000, no: '02 / Eyes Off', title: 'Kem dưỡng mắt', tag: 'Slow Down Your Eyes',
    img: 'assets/img/eyes.jpg', alt: 'Hũ kem dưỡng mắt Eyes Off nắp vàng',
    desc: 'Chăm sóc vùng da quanh mắt sau một ngày nhìn màn hình: tạm ngừng nhìn ra bên ngoài để quay về với bản thân.',
    facts: ['Thành phần: nước tinh khiết, glycerin, dầu hạt hướng dương, vitamin B5 (panthenol), chiết xuất rau má, trà xanh, hoa cúc, sodium hyaluronate', 'Khối lượng: 15g'],
  },
  slow: {
    name: 'Thanh lăn mát xa mặt Slow Off', price: 109000, no: '03 / Slow Off', title: 'Thanh lăn mát xa mặt', tag: 'Let Go',
    img: 'assets/img/slow.jpg', alt: 'Thanh lăn mát xa mặt Slow Off đầu đá xanh',
    desc: 'Khép lại nghi thức: massage nhẹ nhàng giúp giải tỏa căng cơ mặt và đưa cơ thể vào trạng thái ngủ sâu.',
    facts: ['Đầu lăn thép không gỉ 304 (70%), thân cầm nhựa kháng khuẩn ABS (30%)', 'Hộp giấy cứng nắp bật, khay định hình, logo ép kim vàng'],
  },
  set: {
    name: 'lull Ritual Set', price: 299000, old: 327000, no: 'Trọn bộ / Ritual Set', title: 'lull Ritual Set', tag: 'Off The World, On Yourself.',
    img: 'assets/img/set.jpg', alt: 'Bộ lull Ritual: túi thơm, kem dưỡng mắt và thanh lăn',
    desc: 'Combo trọn nghi thức lull Ritual 3 bước, cho trải nghiệm thư giãn đa giác quan.',
    facts: ['1 Túi thơm Mind Off + 1 Kem dưỡng mắt Eyes Off + 1 Thanh lăn Slow Off', 'Mã QR nghe playlist độc quyền (432 Hz) và bài tập thở'],
    save: 'Tiết kiệm 28.000đ so với mua lẻ.',
  },
};
const ORDER = ['mind', 'eyes', 'slow', 'set'];
const KEY = 'lull-cart-v1';
const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';
const $ = (id) => document.getElementById(id);

let cart = {};
try { cart = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cart = {}; }
Object.keys(cart).forEach((id) => { if (!PRODUCTS[id] || !(cart[id] > 0)) delete cart[id]; });

const drawer = $('drawer');
const scrim = $('scrim');
const linesEl = $('lines');
let lastFocus = null;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* storage blocked */ }
}

function render() {
  const ids = Object.keys(cart);
  const count = ids.reduce((s, id) => s + cart[id], 0);
  const total = ids.reduce((s, id) => s + cart[id] * PRODUCTS[id].price, 0);
  $('cart-count').textContent = count;
  $('empty').hidden = ids.length > 0;
  $('drawer-foot').hidden = ids.length === 0;
  $('total').textContent = fmt(total);
  linesEl.textContent = '';
  ids.forEach((id) => {
    const p = PRODUCTS[id];
    const li = document.createElement('li');
    li.className = 'ln';
    li.innerHTML =
      '<h3></h3><span class="p"></span>' +
      '<div class="qty"><button type="button" data-act="dec" aria-label="Giảm số lượng">−</button><span></span><button type="button" data-act="inc" aria-label="Tăng số lượng">+</button></div>' +
      '<button type="button" class="rm" data-act="rm">Xóa</button>';
    li.querySelector('h3').textContent = p.name;
    li.querySelector('.p').textContent = fmt(p.price * cart[id]);
    li.querySelector('.qty span').textContent = cart[id];
    li.dataset.id = id;
    linesEl.appendChild(li);
  });
  $('summary').hidden = true;
}

function openCart() {
  lastFocus = document.activeElement;
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('on'));
  drawer.classList.add('on');
  drawer.setAttribute('aria-hidden', 'false');
  $('cart-close').focus();
}
function closeCart() {
  scrim.classList.remove('on');
  drawer.classList.remove('on');
  drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => { scrim.hidden = true; }, 300);
  if (lastFocus) lastFocus.focus();
}

document.querySelectorAll('.add').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    cart[id] = (cart[id] || 0) + 1;
    save();
    render();

    const old = btn.textContent;
    btn.textContent = 'Đã thêm';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1200);
  });
});

linesEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('.ln').dataset.id;
  if (b.dataset.act === 'inc') cart[id] += 1;
  else if (b.dataset.act === 'dec') cart[id] -= 1;
  else delete cart[id];
  if (cart[id] <= 0) delete cart[id];
  save();
  render();
});

$('cart-open').addEventListener('click', openCart);
$('cart-close').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('on')) closeCart(); });

$('order').addEventListener('click', () => {
  const ids = Object.keys(cart);
  const total = ids.reduce((s, id) => s + cart[id] * PRODUCTS[id].price, 0);
  const text = ['Đơn hàng lull']
    .concat(ids.map((id) => `- ${PRODUCTS[id].name} x${cart[id]}: ${fmt(PRODUCTS[id].price * cart[id])}`))
    .concat(['Tạm tính: ' + fmt(total), 'Họ tên:', 'Số điện thoại:', 'Địa chỉ giao hàng:'])
    .join('\n');
  $('summary-text').value = text;
  $('summary').hidden = false;
});

$('copy').addEventListener('click', async () => {
  const ta = $('summary-text');
  const btn = $('copy');
  try { await navigator.clipboard.writeText(ta.value); }
  catch (e) { ta.select(); document.execCommand('copy'); }
  btn.textContent = 'Đã sao chép';
  setTimeout(() => { btn.textContent = 'Sao chép đơn hàng'; }, 1500);
});

render();

/* intro: tách câu thành từng từ để hiện lần lượt */
(function () {
  const lead = $('lead');
  if (!lead) return;
  const words = lead.textContent.match(/\S+\s*/g) || [];
  lead.setAttribute('aria-label', lead.textContent);
  lead.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    s.textContent = w;
    lead.appendChild(s);
  });
})();

/* focus sản phẩm */
const focusEl = $('focus');
const fStage = focusEl.querySelector('.f-stage');
const fImg = $('f-img');
let cur = null;
let qty = 1;
let focusFrom = null;
let imgIdx = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fill(id) {
  const p = PRODUCTS[id];
  cur = id;
  qty = 1;
  $('f-n').textContent = qty;
  $('f-no').textContent = p.no;
  $('f-name').textContent = p.title;
  $('f-tag').textContent = p.tag;
  $('f-desc').textContent = p.desc;
  const ul = $('f-facts');
  ul.textContent = '';
  p.facts.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  const price = $('f-price');
  price.textContent = '';
  if (p.contact) { price.textContent = 'Liên hệ'; $('f-save').textContent = ''; }
  else if (p.old) { const s = document.createElement('s'); s.textContent = fmt(p.old); price.appendChild(s); }
  if (!p.contact) price.appendChild(document.createTextNode(fmt(p.price)));
  $('f-save').textContent = p.save || '';
  imgIdx = 0;
  fImg.src = p.img;
  fImg.alt = p.alt;
  fStage.style.setProperty('--bg', 'url(../' + p.img + ')');
  fStage.classList.toggle('multi', !!(p.imgs && p.imgs.length > 1));
  fStage.dataset.count = p.imgs ? '1 / ' + p.imgs.length : '';
  $('f-qty').hidden = !!p.contact;
  const add = $('f-add');
  add.disabled = !!p.contact;
  add.textContent = p.contact ? 'Liên hệ để đặt' : 'Thêm vào giỏ';
}

function openFocus(id, fromEl) {
  if (!PRODUCTS[id]) return;
  focusFrom = document.activeElement;
  fill(id);
  focusEl.hidden = false;
  focusEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  const src = fromEl && fromEl.getBoundingClientRect();
  requestAnimationFrame(() => {
    focusEl.classList.add('on');
    if (src && src.width && !reduce) {
      const dst = fStage.getBoundingClientRect();
      const s = src.width / dst.width;
      fStage.style.transformOrigin = 'top left';
      fStage.animate(
        [{ transform: 'translate(' + (src.left - dst.left) + 'px,' + (src.top - dst.top) + 'px) scale(' + s + ')' }, { transform: 'none' }],
        { duration: 750, easing: 'cubic-bezier(.2,.7,.1,1)' }
      );
    }
    $('f-close').focus({ preventScroll: true });
  });
}

function closeFocus() {
  focusEl.classList.remove('on');
  focusEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { focusEl.hidden = true; }, 450);
  if (focusFrom && focusFrom.focus) focusFrom.focus({ preventScroll: true });
}

function step(d) {
  const i = (ORDER.indexOf(cur) + d + ORDER.length) % ORDER.length;
  if (reduce) { fill(ORDER[i]); return; }
  fStage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = () => {
    fill(ORDER[i]);
    fStage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, fill: 'forwards' }).onfinish = (e) => e.target.cancel();
  };
}

document.querySelectorAll('.card').forEach((card) => {
  const slot = card.querySelector('.card-img');
  const open = () => openFocus(card.id.replace('p-', ''), slot);
  slot.addEventListener('click', open);
  slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  card.querySelector('h3').addEventListener('click', open);
  card.querySelector('h3').style.cursor = 'pointer';
});
document.querySelectorAll('.line a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openFocus(a.getAttribute('href').replace('#p-', ''), a.querySelector('.slot'));
  });
});

$('f-close').addEventListener('click', closeFocus);
focusEl.addEventListener('click', (e) => { if (e.target === focusEl || e.target.classList.contains('f-wrap')) closeFocus(); });
$('f-prev').addEventListener('click', () => step(-1));
$('f-next').addEventListener('click', () => step(1));
$('f-dec').addEventListener('click', () => { qty = Math.max(1, qty - 1); $('f-n').textContent = qty; });
$('f-inc').addEventListener('click', () => { qty = Math.min(20, qty + 1); $('f-n').textContent = qty; });
$('f-add').addEventListener('click', () => {
  cart[cur] = (cart[cur] || 0) + qty;
  save();
  render();
  const b = $('f-add');
  b.textContent = 'Đã thêm ' + qty;
  b.classList.add('done');
  setTimeout(() => { b.textContent = 'Thêm vào giỏ'; b.classList.remove('done'); }, 1400);
});
addEventListener('keydown', (e) => {
  if (focusEl.hidden) return;
  if (e.key === 'Escape') closeFocus();
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
});

/* bấm vào ảnh trong focus để đổi ảnh phụ */
fStage.addEventListener('click', () => {
  const p = PRODUCTS[cur];
  if (!p || !p.imgs || p.imgs.length < 2) return;
  imgIdx = (imgIdx + 1) % p.imgs.length;
  fImg.src = p.imgs[imgIdx];
  fStage.style.setProperty('--bg', 'url(../' + p.imgs[imgIdx] + ')');
  fStage.dataset.count = (imgIdx + 1) + ' / ' + p.imgs.length;
});
$('f-add').addEventListener('click', (e) => { if (PRODUCTS[cur] && PRODUCTS[cur].contact) e.stopImmediatePropagation(); }, true);

/* nghi thức 3 bước: tiến độ cuộn điều khiển từng bước và mũi tên nối */
(function () {
  const sec = $('ritual');
  if (!sec) return;
  const steps = [...sec.querySelectorAll('.step')];
  const arrs = [...sec.querySelectorAll('.arr')];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(max-width: 820px)').matches;
  if (calm) {
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); } });
    }, { threshold: 0.3 });
    steps.forEach((s) => (matchMedia('(prefers-reduced-motion: reduce)').matches ? s.classList.add('on') : io.observe(s)));
    return;
  }
  const T = [0, 0.25, 0.3, 0.58, 0.63]; // step1, mũi tên 1, step2, mũi tên 2, step3
  function update() {
    const r = sec.getBoundingClientRect();
    const nav = $('ritual').previousElementSibling ? 48 : 48;
    const span = r.height - innerHeight + nav;
    const p = Math.min(1, Math.max(0, (nav - r.top) / span));
    steps[0].classList.toggle('on', p >= T[0] && r.top < innerHeight * 0.6);
    arrs[0].classList.toggle('on', p > T[1]);
    steps[1].classList.toggle('on', p > T[2]);
    arrs[1].classList.toggle('on', p > T[3]);
    steps[2].classList.toggle('on', p > T[4]);
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();

/* reveal khi cuộn + nav + parallax hero */
(function () {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('.rv, .rv-img');
  if (still || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); }
  else {
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll('.rv-img').forEach((i) => i.classList.add('in'));
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e.classList.contains('rv-img') ? e.parentElement : e));
  }
  const bar = document.querySelector('.bar');
  const vid = document.querySelector('.hero-bg');
  const hero = document.querySelector('.hero');
  let ticking = false;
  function frame() {
    ticking = false;
    const y = scrollY;
    bar.classList.toggle('scrolled', y > 8);
    if (vid && !still && y < hero.offsetHeight + 80) vid.style.transform = 'translate3d(0,' + (y * 0.18).toFixed(1) + 'px,0)';
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  frame();
})();

/* video nền khối nghi thức: chỉ phát khi đang nằm trong màn hình */
(function () {
  const v = document.querySelector('.steps-bg');
  if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); });
  }, { threshold: 0.05 }).observe($('ritual'));
})();
