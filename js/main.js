const PRODUCTS = {
  mind: { name: 'Túi thơm thảo mộc Mind Off', price: 59000 },
  eyes: { name: 'Kem dưỡng mắt Eyes Off', price: 159000 },
  slow: { name: 'Thanh lăn mát xa mặt Slow Off', price: 109000 },
  set: { name: 'lull Ritual Set', price: 299000 },
};
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
