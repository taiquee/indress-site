/* ==========================================================
   INDRESS — Vitrine
   ========================================================== */
const LS_CART = "indress:cart";
let DATA = { settings: {}, products: [] };
const state = { cat: "Todos", q: "", sort: "new" };
let cart = JSON.parse(localStorage.getItem(LS_CART) || "[]");

/* ícones */
$$("[data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ""));
$("#fabWa").innerHTML = ICONS.wa;
$("#year").textContent = new Date().getFullYear();

/* header ao rolar */
addEventListener("scroll", () => $("#header").classList.toggle("scrolled", scrollY > 8), { passive: true });

/* skeleton enquanto carrega */
$("#grid").innerHTML = Array.from({ length: 4 }, () =>
  `<div class="card skel"><div class="card-media"></div><div class="line" style="width:70%"></div><div class="line" style="width:40%"></div></div>`).join("");

init();

async function init() {
  DATA = await Store.load();
  applySettings();
  renderChips();
  renderGrid();
  renderHeroVisual();
  updateCartBadge();
  cart = cart.filter((c) => DATA.products.some((p) => p.id === c.id)); saveCart();
  observeReveal();
  // link direto para produto: /#p=ID
  const m = location.hash.match(/p=([\w-]+)/);
  if (m) openProduct(m[1]);
}

/* ---------- configurações da loja ---------- */
function applySettings() {
  const s = DATA.settings;
  const name = (s.storeName || "Indress").toUpperCase();
  $("#brandName").textContent = name; $("#footBrand").textContent = name;
  document.title = `${s.storeName || "Indress"} — Moda fit feminina`;

  // título do hero: última palavra vira contorno
  const words = (s.heroTitle || "Treine do seu jeito").trim().split(/\s+/);
  const last = words.pop();
  const first = words.shift() || "";
  $("#heroTitle").innerHTML = `${esc(first)} ${words.length ? `<em>${esc(words.join(" "))}</em> ` : ""}<span class="outline">${esc(last)}</span>`;
  $("#heroText").textContent = s.heroText || "";

  const hello = `Olá! Vim pelo site da ${s.storeName || "Indress"} e gostaria de atendimento 💕`;
  const wa = waLink(s.whatsapp, hello);
  ["#heroWa", "#bandWa", "#footWa", "#fabWa"].forEach((id) => { const a = $(id); a.href = wa; a.target = "_blank"; a.rel = "noopener"; });
  $("#footIg").href = `https://instagram.com/${(s.instagram || "").replace("@", "")}`;
  $("#footCity").textContent = s.city || "";

  const items = ["Moda fit feminina", "Atendimento no WhatsApp", "Conforto em cada movimento", "Escolha · envie · finalize", "Feito para treinar"];
  const run = items.map((t) => `<span>${esc(t)}</span>`).join("");
  $("#marquee").innerHTML = run + run;
}

function renderHeroVisual() {
  const pics = DATA.products.filter((p) => p.available !== false)
    .sort((a, b) => (b.featured - a.featured) || ((b.images?.length ? 1 : 0) - (a.images?.length ? 1 : 0)));
  const cards = $$("#heroVisual img");
  [1, 0, 2].forEach((pi, idx) => {
    const p = pics[pi % Math.max(pics.length, 1)];
    cards[idx].src = p ? imgOf(p) : placeholder("hero" + idx, idx);
  });
}

/* ---------- filtros ---------- */
function renderChips() {
  const used = new Set(DATA.products.map((p) => p.category).filter(Boolean));
  const cats = ["Todos", ...DATA.settings.categories.filter((c) => used.has(c)), ...[...used].filter((c) => !DATA.settings.categories.includes(c))];
  if (DATA.products.some(isSale)) cats.splice(1, 0, "Promoções");
  $("#chips").innerHTML = cats.map((c) => `<button class="chip" aria-pressed="${c === state.cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  state.cat = b.dataset.cat;
  $$(".chip").forEach((c) => c.setAttribute("aria-pressed", c === b));
  renderGrid();
});
let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value; renderGrid(); }, 140); });
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
$("#searchBtn").addEventListener("click", () => { $("#colecao").scrollIntoView({ behavior: "smooth" }); setTimeout(() => $("#q").focus({ preventScroll: true }), 450); });

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function filtered() {
  const q = norm(state.q.trim());
  let list = DATA.products.filter((p) => {
    if (state.cat === "Promoções" && !isSale(p)) return false;
    if (state.cat !== "Todos" && state.cat !== "Promoções" && p.category !== state.cat) return false;
    if (q && !norm(`${p.name} ${p.category} ${p.description} ${(p.colors || []).join(" ")}`).includes(q)) return false;
    return true;
  });
  const byAvail = (a, b) => (b.available !== false) - (a.available !== false);
  const sorts = {
    new: (a, b) => byAvail(a, b) || (b.featured - a.featured) || (new Date(b.createdAt) - new Date(a.createdAt)),
    low: (a, b) => byAvail(a, b) || finalPrice(a) - finalPrice(b),
    high: (a, b) => byAvail(a, b) || finalPrice(b) - finalPrice(a),
    sale: (a, b) => byAvail(a, b) || (isSale(b) - isSale(a)),
  };
  return list.sort(sorts[state.sort]);
}

function priceHTML(p) {
  return isSale(p)
    ? `<div class="price"><span class="now sale">${brl(p.promoPrice)}</span><span class="was">${brl(p.price)}</span></div>`
    : `<div class="price"><span class="now">${brl(p.price)}</span></div>`;
}

function renderGrid() {
  const list = filtered();
  const n = list.length;
  $("#resultInfo").textContent = n ? `${n} ${n === 1 ? "peça" : "peças"}${state.cat !== "Todos" ? " em " + state.cat : ""}` : "Nenhuma peça encontrada";
  if (!n) {
    $("#grid").innerHTML = `<div class="empty"><strong>Nada por aqui ainda</strong>${state.q ? "Tente outra palavra na busca." : "Novas peças chegam em breve. Chame no WhatsApp!"}</div>`;
    return;
  }
  $("#grid").innerHTML = list.map((p, i) => {
    const out = p.available === false;
    const off = isSale(p) ? Math.round((1 - p.promoPrice / p.price) * 100) : 0;
    const tags = [
      out ? `<span class="tag out">Esgotado</span>` : "",
      !out && off ? `<span class="tag sale">-${off}%</span>` : "",
      !out && !off && isNew(p) ? `<span class="tag new">Novo</span>` : "",
    ].join("");
    return `<article class="card reveal ${out ? "is-out" : ""}" style="transition-delay:${Math.min(i, 8) * 40}ms">
      <div class="card-top"><button class="card-media" data-open="${p.id}" aria-label="Ver ${esc(p.name)}">
        <div class="tags">${tags}</div>
        <img class="main" src="${esc(imgOf(p, 0))}" alt="${esc(p.name)}" loading="lazy" decoding="async" />
        ${p.images?.[1] ? `<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy" decoding="async" />` : ""}
      </button>
      ${out ? "" : `<button class="quick-add" data-open="${p.id}" aria-label="Adicionar ${esc(p.name)} à sacola">${ICONS.plus}</button>`}</div>
      <button class="card-info" data-open="${p.id}" style="text-align:left">
        <div class="card-cat">${esc(p.category)}</div>
        <h3 class="card-name">${esc(p.name)}</h3>
        ${priceHTML(p)}
      </button>
    </article>`;
  }).join("");
  observeReveal();
}
$("#grid").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openProduct(b.dataset.open); });

/* ---------- detalhe do produto ---------- */
let sel = { size: null, color: null, qty: 1 };
function openProduct(id) {
  const p = DATA.products.find((x) => x.id === id); if (!p) return;
  const out = p.available === false;
  sel = { size: p.sizes.length === 1 ? p.sizes[0] : null, color: p.colors.length === 1 ? p.colors[0] : null, qty: 1 };
  const imgs = p.images.length ? p.images : [imgOf(p, 0)];
  $("#sheetBody").innerHTML = `
  <div class="pd">
    <div class="pd-gallery ${imgs.length > 1 ? "" : "single"}">
      <div class="pd-thumbs">${imgs.length > 1 ? imgs.map((src, i) => `<button data-thumb="${i}" class="${i ? "" : "on"}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("") : ""}</div>
      <div style="position:relative;min-width:0">
        <div class="pd-slides" id="slides">${imgs.map((src, i) => `<img src="${esc(src)}" alt="${esc(p.name)} — foto ${i + 1}" ${i ? 'loading="lazy"' : ""}>`).join("")}</div>
        ${imgs.length > 1 ? `<div class="pd-dots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
      </div>
    </div>
    <div class="pd-info">
      <div class="card-cat">${esc(p.category)}</div>
      <h2>${esc(p.name)}</h2>
      ${priceHTML(p)}
      ${p.description ? `<p class="pd-desc">${esc(p.description)}</p>` : ""}
      ${p.sizes.length ? `<div class="opt"><div class="opt-label">Tamanho <span id="selSize">${sel.size ? esc(sel.size) : "Selecione"}</span></div>
        <div class="opts" id="optSize">${p.sizes.map((s) => `<button class="opt-btn" data-size="${esc(s)}" aria-pressed="${s === sel.size}">${esc(s)}</button>`).join("")}</div></div>` : ""}
      ${p.colors.length ? `<div class="opt"><div class="opt-label">Cor <span id="selColor">${sel.color ? esc(sel.color) : "Selecione"}</span></div>
        <div class="opts" id="optColor">${p.colors.map((c) => `<button class="opt-btn" data-color="${esc(c)}" aria-pressed="${c === sel.color}">${esc(c)}</button>`).join("")}</div></div>` : ""}
      ${out ? "" : `<div class="opt"><div class="opt-label">Quantidade</div>
        <div class="qty"><button data-q="-1" aria-label="Diminuir">−</button><output id="qtyOut">1</output><button data-q="1" aria-label="Aumentar">+</button></div></div>`}
      <div class="pd-actions">
        ${out
          ? `<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${esc(waLink(DATA.settings.whatsapp, `Olá! Vi no site que o produto "${p.name}" está esgotado. Vai voltar? Pode me avisar? 💕`))}"><span style="width:22px;height:22px;display:inline-grid">${ICONS.wa}</span>Avise-me quando voltar</a>`
          : `<button class="btn btn-dark btn-block" id="addBtn">${ICONS.bag} Adicionar à sacola</button>
             <button class="btn btn-wa btn-block" id="buyNow"><span style="width:22px;height:22px;display:inline-grid">${ICONS.wa}</span>Comprar agora pelo WhatsApp</button>`}
      </div>
      <p class="pd-note">🔒 Sem cadastro e sem pagamento no site: você finaliza conversando com a gente.</p>
    </div>
  </div>`;

  const body = $("#sheetBody");
  body.scrollTop = 0;
  const slides = $("#slides", body);
  slides.addEventListener("scroll", () => {
    const i = Math.round(slides.scrollLeft / slides.clientWidth);
    $$(".pd-dots i", body).forEach((d, k) => d.classList.toggle("on", k === i));
    $$(".pd-thumbs button", body).forEach((d, k) => d.classList.toggle("on", k === i));
  }, { passive: true });

  body.onclick = (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.thumb) slides.scrollTo({ left: slides.clientWidth * +t.dataset.thumb, behavior: "smooth" });
    if (t.dataset.size) { sel.size = t.dataset.size; $$("#optSize .opt-btn", body).forEach((b) => b.setAttribute("aria-pressed", b === t)); $("#selSize").textContent = sel.size; }
    if (t.dataset.color) { sel.color = t.dataset.color; $$("#optColor .opt-btn", body).forEach((b) => b.setAttribute("aria-pressed", b === t)); $("#selColor").textContent = sel.color; }
    if (t.dataset.q) { sel.qty = Math.max(1, Math.min(20, sel.qty + +t.dataset.q)); $("#qtyOut").textContent = sel.qty; }
    if (t.id === "addBtn") { if (validate(p)) { addToCart(p); closeAll(); toast("Adicionado à sacola ✓"); } }
    if (t.id === "buyNow") {
      if (!validate(p)) return;
      addToCart(p, true);
      closeAll(); setTimeout(openCart, 250);
    }
  };

  history.replaceState(null, "", `#p=${p.id}`);
  open($("#sheet"));
}

function validate(p) {
  if (p.sizes.length && !sel.size) { nudge("#optSize", "Escolha um tamanho"); return false; }
  if (p.colors.length && !sel.color) { nudge("#optColor", "Escolha uma cor"); return false; }
  return true;
}
function nudge(sel_, msg) {
  const el = $(sel_); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  el.scrollIntoView({ block: "center", behavior: "smooth" }); toast(msg);
}

/* ---------- sacola ---------- */
function saveCart() { localStorage.setItem(LS_CART, JSON.stringify(cart)); updateCartBadge(); }
function addToCart(p, silent) {
  const key = `${p.id}|${sel.size || ""}|${sel.color || ""}`;
  const ex = cart.find((c) => c.key === key);
  if (ex) ex.qty = Math.min(20, ex.qty + sel.qty);
  else cart.push({ key, id: p.id, size: sel.size, color: sel.color, qty: sel.qty });
  saveCart();
  const b = $("#cartCount"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
}
function updateCartBadge() {
  const n = cart.reduce((s, c) => s + c.qty, 0);
  const b = $("#cartCount"); b.textContent = n; b.classList.toggle("show", n > 0);
}
const prod = (id) => DATA.products.find((p) => p.id === id);
const cartTotal = () => cart.reduce((s, c) => s + (prod(c.id) ? finalPrice(prod(c.id)) * c.qty : 0), 0);

function renderCart() {
  if (!cart.length) {
    $("#cartBody").innerHTML = `<div class="cart-empty"><div class="big">🛍️</div><strong style="color:var(--ink)">Sua sacola está vazia</strong><p>Explore a coleção e escolha suas favoritas.</p></div>`;
    $("#cartFoot").innerHTML = `<button class="btn btn-dark btn-block" data-close data-goto="#colecao">Ver coleção</button>`;
    return;
  }
  $("#cartBody").innerHTML = cart.map((c, i) => {
    const p = prod(c.id); if (!p) return "";
    const meta = [c.size && `Tam. ${c.size}`, c.color].filter(Boolean).join(" · ");
    return `<div class="cart-item">
      <img src="${esc(imgOf(p))}" alt="">
      <div><h4>${esc(p.name)}</h4><div class="meta">${esc(meta)} · ${brl(finalPrice(p))}</div>
        <div class="qty"><button data-ci="${i}" data-d="-1" aria-label="Diminuir">−</button><output>${c.qty}</output><button data-ci="${i}" data-d="1" aria-label="Aumentar">+</button></div>
        <div><button class="rm" data-rm="${i}">Remover</button></div></div>
      <div class="line-total">${brl(finalPrice(p) * c.qty)}</div>
    </div>`;
  }).join("");
  const savedName = localStorage.getItem("indress:name") || "";
  $("#cartFoot").innerHTML = `
    <div class="total-row"><span>Total</span><strong>${brl(cartTotal())}</strong></div>
    <p class="small">${cart.some((c) => prod(c.id) && !(finalPrice(prod(c.id)) > 0)) ? "Algumas peças têm valor sob consulta. " : ""}Frete e forma de pagamento combinados no WhatsApp.</p>
    <div class="field"><label for="cName">Seu nome</label><input id="cName" autocomplete="given-name" placeholder="Como podemos te chamar?" value="${esc(savedName)}"></div>
    <button class="btn btn-wa btn-block" id="sendWa"><span style="width:22px;height:22px;display:inline-grid">${ICONS.wa}</span>Enviar pedido pelo WhatsApp</button>`;
}
$("#cartBody").addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.ci) { const c = cart[+t.dataset.ci]; c.qty += +t.dataset.d; if (c.qty < 1) cart.splice(+t.dataset.ci, 1); saveCart(); renderCart(); }
  if (t.dataset.rm) { cart.splice(+t.dataset.rm, 1); saveCart(); renderCart(); }
});
$("#cartFoot").addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.goto) { closeAll(); setTimeout(() => $(t.dataset.goto).scrollIntoView({ behavior: "smooth" }), 200); }
  if (t.id === "sendWa") sendOrder();
});

function sendOrder() {
  const s = DATA.settings;
  const name = ($("#cName")?.value || "").trim();
  if (name) localStorage.setItem("indress:name", name);
  const lines = cart.map((c) => {
    const p = prod(c.id); if (!p) return "";
    const meta = [c.size && `Tam: ${c.size}`, c.color && `Cor: ${c.color}`].filter(Boolean).join(" | ");
    return `• ${c.qty}x *${p.name}*${meta ? `\n   ${meta}` : ""}\n   ${finalPrice(p) > 0 ? `${brl(finalPrice(p))} cada = ${brl(finalPrice(p) * c.qty)}` : "Valor sob consulta"}`;
  }).filter(Boolean);
  const msg =
`Olá! ${name ? `Sou a ${name} e ` : ""}vim pelo site da ${s.storeName || "Indress"} 💕
Quero fazer este pedido:

${lines.join("\n\n")}

${cartTotal() > 0 ? `*Total: ${brl(cartTotal())}*${cart.some((c) => prod(c.id) && !(finalPrice(prod(c.id)) > 0)) ? " (+ peças sob consulta)" : ""}` : "*Valores: a combinar*"}

Pode me confirmar a disponibilidade, o frete e as formas de pagamento?`;
  window.open(waLink(s.whatsapp, msg), "_blank", "noopener");
  toast("Abrindo o WhatsApp…");
}

/* ---------- abrir / fechar camadas ---------- */
let lastFocus;
function open(el) {
  lastFocus = document.activeElement;
  $("#overlay").classList.add("open"); el.classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => el.querySelector("[data-close]")?.focus({ preventScroll: true }), 50);
}
function closeAll() {
  $$(".sheet.open,.drawer.open").forEach((el) => el.classList.remove("open"));
  $("#overlay").classList.remove("open");
  document.body.style.overflow = "";
  if (location.hash.startsWith("#p=")) history.replaceState(null, "", location.pathname);
  lastFocus?.focus?.({ preventScroll: true });
}
function openCart() { renderCart(); open($("#drawer")); }
$("#cartBtn").addEventListener("click", openCart);
$("#overlay").addEventListener("click", closeAll);
document.addEventListener("click", (e) => { if (e.target.closest("[data-close]") && !e.target.closest("[data-goto]")) closeAll(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

/* arrastar para baixo fecha o sheet (mobile) */
(() => {
  const sh = $("#sheet"); let y0 = null, dy = 0;
  sh.addEventListener("touchstart", (e) => { if ($("#sheetBody").scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener("touchmove", (e) => {
    if (y0 === null || matchMedia("(min-width:900px)").matches) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) { sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  sh.addEventListener("touchend", () => {
    sh.style.transition = ""; sh.style.transform = "";
    if (dy > 110) closeAll();
    y0 = null; dy = 0;
  });
})();

/* ---------- animação de entrada ---------- */
let io;
function observeReveal() {
  io ||= new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal:not(.in)").forEach((el) => io.observe(el));
}
