/* ==========================================================
   INDRESS — Painel da loja
   ========================================================== */
let DATA, PW = sessionStorage.getItem("indress:pw") || "";
let editing = null; // cópia do produto em edição

$$("[data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ""));

(async function boot() {
  DATA = await Store.load();
  if (Store.mode === "github") {
    PW = localStorage.getItem("indress:token") || PW;
    $("label[for=pw]").textContent = "Chave de acesso (token do GitHub)";
    $("#pw").placeholder = "github_pat_…";
    $("#loginHint").innerHTML = `Primeira vez? Veja como gerar a chave no <a href="https://github.com/${GH.owner}/${GH.repo}#painel-da-loja" target="_blank" style="text-decoration:underline">guia</a>.`;
  }
  if (Store.mode === "local") $("#loginHint").textContent = "Modo de teste: qualquer senha entra.";
  if (PW && (await Store.checkPassword(PW))) { if (Store.mode === "github") DATA = await Store.load(PW); enter(); }
})();

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("#pw").value;
  const btn = e.submitter; btn.disabled = true; btn.textContent = "Entrando…";
  const ok = await Store.checkPassword(pw).catch(() => false);
  btn.disabled = false; btn.textContent = "Entrar";
  if (!ok) { toast("Senha incorreta"); $("#pw").select(); return; }
  PW = pw; sessionStorage.setItem("indress:pw", pw);
  if (Store.mode === "github") { localStorage.setItem("indress:token", pw); DATA = await Store.load(PW); }
  enter();
});

function logout() { sessionStorage.removeItem("indress:pw"); localStorage.removeItem("indress:token"); location.reload(); }
function enter() {
  $("#loginView").hidden = true; $("#appView").hidden = false;
  renderBanners(); renderStats(); renderList(); fillSettings();
}

function renderBanners() {
  const b = [];
  if (Store.mode === "github") b.push(`<div class="banner">✅ <span>Tudo que você salvar aqui aparece no site em <b>cerca de 1 minuto</b>.</span></div>`);
  if (Store.mode === "local") b.push(`<div class="banner">⚠️ <span><b>Modo de teste:</b> as alterações ficam salvas só neste navegador. Depois de publicar o site, tudo passa a ficar online para todas as clientes.</span></div>`);
  if (!onlyDigits(DATA.settings.whatsapp)) b.push(`<div class="banner warn">📱 <span><b>Falta o WhatsApp da loja.</b> Configure em <a href="#" data-goto-settings style="text-decoration:underline">Configurações</a> para os pedidos chegarem até você.</span></div>`);
  if (DATA.products.some((p) => /\(exemplo\)/.test(p.name))) b.push(`<div class="banner">🧺 <span>Há produtos de <b>exemplo</b>. Edite-os com suas peças reais ou apague.</span></div>`);
  $("#banners").innerHTML = b.join("");
}
$("#banners").addEventListener("click", (e) => { if (e.target.closest("[data-goto-settings]")) { e.preventDefault(); switchTab("settings"); } });

/* ---------- abas ---------- */
$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
function switchTab(name) {
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
  $("#tab-products").hidden = name !== "products";
  $("#tab-settings").hidden = name !== "settings";
  scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- lista ---------- */
function renderStats() {
  const p = DATA.products;
  $("#stats").innerHTML = `
    <div class="stat"><b>${p.length}</b><span>Produtos</span></div>
    <div class="stat"><b>${p.filter((x) => x.available !== false).length}</b><span>À venda</span></div>
    <div class="stat"><b>${p.filter(isSale).length}</b><span>Em promoção</span></div>`;
}
$("#aq").addEventListener("input", renderList);
function renderList() {
  const q = $("#aq").value.toLowerCase();
  const list = DATA.products.filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) {
    $("#list").innerHTML = `<div class="empty" style="background:#fff;border-radius:18px"><strong>${q ? "Nada encontrado" : "Nenhum produto ainda"}</strong>${q ? "" : "Toque em “Novo produto” para cadastrar a primeira peça."}</div>`;
    return;
  }
  $("#list").innerHTML = list.map((p) => `
    <div class="row">
      <img src="${esc(imgOf(p))}" alt="">
      <div style="min-width:0">
        <h3>${esc(p.name)}</h3>
        <div class="sub">${esc(p.category || "Sem categoria")} · ${p.images.length} foto${p.images.length === 1 ? "" : "s"}</div>
        ${isSale(p) ? `<div class="price"><span class="now sale">${brl(p.promoPrice)}</span><span class="was">${brl(p.price)}</span></div>` : `<div class="price"><span class="now">${brl(p.price)}</span></div>`}
      </div>
      <div class="row-actions">
        <button class="pill ${p.available !== false ? "on" : "off"}" data-toggle="${p.id}" title="Tocar para alternar">${p.available !== false ? "À venda" : "Esgotado"}</button>
        <button class="mini" data-edit="${p.id}">Editar</button>
      </div>
    </div>`).join("");
}
$("#list").addEventListener("click", async (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.edit) openForm(DATA.products.find((p) => p.id === t.dataset.edit));
  if (t.dataset.toggle) {
    const p = DATA.products.find((x) => x.id === t.dataset.toggle);
    p.available = p.available === false;
    await persist(p.available ? "Marcado como à venda" : "Marcado como esgotado");
  }
});
$("#newBtn").addEventListener("click", () => openForm(null));

async function persist(msg) {
  try { await Store.save(DATA, PW); renderStats(); renderList(); renderBanners(); if (msg) toast(msg); return true; }
  catch (err) { toast(err.message || "Erro ao salvar"); if (/senha/i.test(err.message)) { sessionStorage.removeItem("indress:pw"); localStorage.removeItem("indress:token"); location.reload(); } return false; }
}

/* ---------- formulário de produto ---------- */
const SIZE_PRESETS = ["PP", "P", "M", "G", "GG", "XG", "Único"];

function openForm(p) {
  const isNewP = !p;
  editing = JSON.parse(JSON.stringify(p || { id: uid(), name: "", price: "", promoPrice: "", category: DATA.settings.categories[0] || "", description: "", sizes: ["P", "M", "G"], colors: [], images: [], available: true, featured: false, createdAt: new Date().toISOString() }));
  const cats = [...new Set([...DATA.settings.categories, editing.category].filter(Boolean))];
  $("#formBody").innerHTML = `
  <form class="form" id="pForm" novalidate>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0">${isNewP ? "Novo produto" : "Editar produto"}</h2>
      <button type="button" class="icon-btn" data-cancel aria-label="Fechar">${ICONS.close}</button>
    </div>

    <div class="field" style="margin-top:12px"><label>Fotos</label>
      <div class="photos" id="photos"></div>
      <span class="hint">A primeira foto é a capa. Use fotos em pé (vertical) para ficar mais bonito.</span>
    </div>

    <div class="field"><label for="fName">Nome do produto *</label><input id="fName" required maxlength="80" placeholder="Ex: Conjunto Power Rosa" value="${esc(editing.name)}"></div>

    <div class="grid2">
      <div class="field"><label for="fPrice">Preço (R$)</label><input id="fPrice" inputmode="decimal" placeholder="Vazio = sob consulta" value="${editing.price !== "" ? esc(String(editing.price).replace(".", ",")) : ""}"></div>
      <div class="field"><label for="fPromo">Preço promocional</label><input id="fPromo" inputmode="decimal" placeholder="Opcional" value="${editing.promoPrice ? esc(String(editing.promoPrice).replace(".", ",")) : ""}"></div>
    </div>

    <div class="field"><label for="fCat">Categoria</label>
      <select id="fCat">${cats.map((c) => `<option ${c === editing.category ? "selected" : ""}>${esc(c)}</option>`).join("")}<option value="__new">+ Nova categoria…</option></select></div>

    <div class="field"><label for="fDesc">Descrição</label><textarea id="fDesc" rows="5" maxlength="1200" placeholder="Tecido, modelagem, detalhes, dicas de tamanho…">${esc(editing.description)}</textarea></div>

    <div class="field"><label>Tamanhos</label><div class="taginput" id="fSizes"></div>
      <div class="presets" id="sizePresets">${SIZE_PRESETS.map((s) => `<button type="button" data-s="${s}">+ ${s}</button>`).join("")}</div></div>

    <div class="field"><label>Cores</label><div class="taginput" id="fColors"></div><span class="hint">Digite a cor e aperte Enter (ex: Preto, Rosa).</span></div>

    <div class="toggles">
      <label class="toggle"><span><b>À venda</b><small>Desligue quando esgotar — a peça continua no site com o selo “Esgotado”.</small></span>
        <span class="switch"><input type="checkbox" id="fAvail" ${editing.available !== false ? "checked" : ""}><span></span></span></label>
      <label class="toggle"><span><b>Destaque</b><small>Aparece primeiro na coleção e no topo do site.</small></span>
        <span class="switch"><input type="checkbox" id="fFeat" ${editing.featured ? "checked" : ""}><span></span></span></label>
    </div>

    ${isNewP ? "" : `<button type="button" class="danger" data-delete>Excluir produto</button>`}

    <div class="savebar">
      <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn btn-dark" id="saveBtn">Salvar</button>
    </div>
  </form>`;

  renderPhotos();
  tagInput($("#fSizes"), editing.sizes, "Ex: M");
  tagInput($("#fColors"), editing.colors, "Adicionar cor");
  $("#sizePresets").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b && !editing.sizes.includes(b.dataset.s)) { editing.sizes.push(b.dataset.s); tagInput($("#fSizes"), editing.sizes, "Ex: M"); } };
  $("#fCat").onchange = (e) => {
    if (e.target.value !== "__new") return;
    const n = (prompt("Nome da nova categoria:") || "").trim();
    if (n) { if (!DATA.settings.categories.includes(n)) DATA.settings.categories.push(n); const o = new Option(n, n, true, true); e.target.add(o, e.target.options.length - 1); }
    else e.target.selectedIndex = 0;
  };
  $("#pForm").onsubmit = (e) => { e.preventDefault(); saveProduct(isNewP); };
  $("#formBody").onclick = async (e) => {
    if (e.target.closest("[data-cancel]")) closeForm();
    if (e.target.closest("[data-delete]")) {
      if (!confirm(`Excluir “${editing.name}”? Essa ação não pode ser desfeita.`)) return;
      DATA.products = DATA.products.filter((x) => x.id !== editing.id);
      if (await persist("Produto excluído")) closeForm();
    }
  };

  $("#overlay").classList.add("open"); $("#formSheet").classList.add("open");
  document.body.style.overflow = "hidden"; $("#formBody").scrollTop = 0;
}
function closeForm() {
  $("#overlay").classList.remove("open"); $("#formSheet").classList.remove("open");
  document.body.style.overflow = ""; editing = null;
}
$("#overlay").addEventListener("click", () => { if (editing && confirm("Sair sem salvar?")) closeForm(); });

/* fotos */
function renderPhotos(uploading = 0) {
  $("#photos").innerHTML = editing.images.map((src, i) => `
    <div class="ph"><img src="${esc(src)}" alt="">${i === 0 ? `<span class="cover">CAPA</span>` : ""}
      <div class="ph-act">
        ${i > 0 ? `<button type="button" data-cover="${i}" aria-label="Tornar capa" title="Tornar capa">★</button>` : "<span></span>"}
        <button type="button" data-rmimg="${i}" aria-label="Remover foto" title="Remover">🗑</button>
      </div></div>`).join("")
    + Array.from({ length: uploading }, () => `<div class="ph loading"></div>`).join("")
    + `<label class="ph-add">${ICONS.plus}<span>Adicionar<br>fotos</span><input type="file" accept="image/*" multiple hidden id="fFiles"></label>`;
  $("#fFiles").onchange = (e) => addPhotos([...e.target.files]);
  $("#photos").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rmimg) { editing.images.splice(+b.dataset.rmimg, 1); renderPhotos(); }
    if (b.dataset.cover) { const [x] = editing.images.splice(+b.dataset.cover, 1); editing.images.unshift(x); renderPhotos(); }
  };
}
async function addPhotos(files) {
  files = files.slice(0, 10);
  renderPhotos(files.length);
  const saveBtn = $("#saveBtn"); saveBtn.disabled = true;
  for (const f of files) {
    try { const blob = await compressImage(f); const url = await Store.upload(blob, PW); editing.images.push(url); }
    catch (err) { toast(err.message || "Não foi possível usar essa foto"); }
    renderPhotos(Math.max(0, files.length - 1 - files.indexOf(f)));
  }
  renderPhotos(); saveBtn.disabled = false;
}

/* tags (tamanhos / cores / categorias) */
function tagInput(el, arr, ph) {
  el.innerHTML = arr.map((t, i) => `<span class="t">${esc(t)}<button type="button" data-i="${i}" aria-label="Remover ${esc(t)}">×</button></span>`).join("")
    + `<input placeholder="${esc(ph)}" enterkeyhint="done">`;
  const input = el.querySelector("input");
  const add = () => { const v = input.value.trim().replace(/,$/, ""); if (v && !arr.includes(v)) arr.push(v); input.value = ""; tagInput(el, arr, ph); el.querySelector("input").focus(); };
  input.onkeydown = (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } if (e.key === "Backspace" && !input.value && arr.length) { arr.pop(); tagInput(el, arr, ph); el.querySelector("input").focus(); } };
  input.onblur = () => { if (input.value.trim()) add(); };
  el.onclick = (e) => { const b = e.target.closest("button[data-i]"); if (b) { arr.splice(+b.dataset.i, 1); tagInput(el, arr, ph); } };
}

const parseMoney = (s) => { s = String(s || "").replace(/[^\d,.]/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isNaN(n) ? null : Math.round(n * 100) / 100; };

async function saveProduct(isNewP) {
  const name = $("#fName").value.trim();
  const price = parseMoney($("#fPrice").value);
  const promo = parseMoney($("#fPromo").value);
  if (!name) { toast("Dê um nome ao produto"); $("#fName").focus(); return; }
  if (promo && price && promo >= price) { toast("O preço promocional deve ser menor que o preço normal"); $("#fPromo").focus(); return; }
  Object.assign(editing, {
    name, price: price || 0, promoPrice: (price && promo) || null,
    category: $("#fCat").value === "__new" ? "" : $("#fCat").value,
    description: $("#fDesc").value.trim(),
    available: $("#fAvail").checked, featured: $("#fFeat").checked,
  });
  const i = DATA.products.findIndex((x) => x.id === editing.id);
  if (i >= 0) DATA.products[i] = editing; else DATA.products.unshift(editing);
  const btn = $("#saveBtn"); btn.disabled = true; btn.textContent = "Salvando…";
  const ok = await persist(isNewP ? "Produto publicado ✓" : "Alterações salvas ✓");
  btn.disabled = false; btn.textContent = "Salvar";
  if (ok) closeForm();
}

/* ---------- configurações ---------- */
let catsDraft = [];
function fillSettings() {
  const s = DATA.settings;
  $("#sWa").value = s.whatsapp || ""; $("#sName").value = s.storeName || ""; $("#sIg").value = s.instagram || "";
  $("#sHero").value = s.heroTitle || ""; $("#sHeroText").value = s.heroText || ""; $("#sCity").value = s.city || "";
  catsDraft = [...s.categories]; tagInput($("#sCats"), catsDraft, "Nova categoria");
}
$("#settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  let wa = onlyDigits($("#sWa").value);
  if (wa && wa.length <= 11) wa = "55" + wa; // adiciona código do Brasil
  if (wa && (wa.length < 12 || wa.length > 13)) { toast("Confira o número: DDD + número"); $("#sWa").focus(); return; }
  Object.assign(DATA.settings, {
    whatsapp: wa, storeName: $("#sName").value.trim() || "Indress", instagram: $("#sIg").value.trim().replace("@", ""),
    heroTitle: $("#sHero").value.trim(), heroText: $("#sHeroText").value.trim(), city: $("#sCity").value.trim(),
    categories: catsDraft.length ? catsDraft : ["Conjuntos"],
  });
  if (await persist("Configurações salvas ✓")) fillSettings();
});
