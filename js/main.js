const PRODUCTS = {
  mind: {
    name: 'Túi thơm thảo mộc Mind Off', price: 59000, no: '01 / Mind Off', title: 'Túi thơm thảo mộc', tag: 'Signal to Rest',
    img: 'assets/img/mind.jpg', alt: 'Túi thơm Mind Off màu xanh rêu, thêu logo lull vàng',
    desc: 'Bước đầu của lull Ritual: một tín hiệu nhẹ để cơ thể bắt đầu nghỉ.',
    facts: ['Thành phần: vỏ sen, trần bì, hoa cúc', 'Khối lượng: 50g'],
  },
  eyes: {
    name: 'Kem dưỡng mắt Eyes Off', price: 159000, no: '02 / Eyes Off', title: 'Kem dưỡng mắt', tag: 'Slow Down Your Eyes',
    img: 'assets/img/eyes.jpg', alt: 'Hũ kem dưỡng mắt Eyes Off nắp vàng',
    desc: 'Bước thứ hai của lull Ritual: làm chậm đôi mắt sau một ngày nhìn màn hình.',
    facts: ['Thành phần: rau má, trà xanh, hoa cúc', 'Khối lượng: 15g'],
  },
  slow: {
    name: 'Thanh lăn mát xa mặt Slow Off', price: 109000, no: '03 / Slow Off', title: 'Thanh lăn mát xa mặt', tag: 'Let Go',
    img: 'assets/img/slow.jpg', alt: 'Thanh lăn mát xa mặt Slow Off đầu đá xanh',
    desc: 'Bước cuối của lull Ritual: đặt điện thoại xuống, lăn nhẹ nhàng và thở sâu trong 2 phút.',
    facts: ['Đầu lăn thép không gỉ 304', 'Mã QR trong hộp dẫn tới hướng dẫn 3 bước'],
  },
  set: {
    name: 'lull Ritual Set', price: 299000, old: 327000, no: 'Trọn bộ / Ritual Set', title: 'lull Ritual Set', tag: 'Off The World, On Yourself.',
    img: 'assets/img/set.jpg', alt: 'Bộ lull Ritual: túi thơm, kem dưỡng mắt và thanh lăn',
    desc: 'Cả ba bước trong một bộ, theo đúng thứ tự: Mind Off, Eyes Off, Slow Off.',
    facts: ['3 sản phẩm', 'Kèm mã QR playlist 432 Hz và bài tập thở'],
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
  if (p.old) { const s = document.createElement('s'); s.textContent = fmt(p.old); price.appendChild(s); }
  price.appendChild(document.createTextNode(fmt(p.price)));
  $('f-save').textContent = p.save || '';
  fImg.src = p.img;
  fImg.alt = p.alt;
  fStage.style.background = id === 'set' ? '#B5ACA3' : '';
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
