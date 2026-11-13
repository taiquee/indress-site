/* ==========================================================
   INDRESS — utilidades compartilhadas (loja + painel)
   Armazenamento:
   - "remote": quando hospedado na Vercel com Blob (api/data e api/upload)
   - "local":  modo de teste, salva só neste navegador (localStorage)
   ========================================================== */
const LS_DATA = "indress:data";
const ROOT = location.pathname.includes("/admin") ? "../" : "./";

/* Repositório do GitHub Pages (ex.: taiquee.github.io/indress-site) */
const GH = (() => {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  if (!m) return null;
  const repo = location.pathname.split("/").filter(Boolean)[0];
  return { owner: m[1], repo: repo && repo !== "admin" ? repo : `${m[1]}.github.io`, branch: "main" };
})();
const DATA_PATH = "data/products.json";

const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
const blobToB64 = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(blob); });

/*
  Modos de armazenamento:
  - "github": site no GitHub Pages; o painel salva no repositório com um token
  - "remote": site na Vercel com Blob (api/data e api/upload)
  - "local":  teste no próprio computador (salva só no navegador)
*/
const Store = {
  mode: GH ? "github" : "local",

  async gh(path, opts = {}, token) {
    const r = await fetch(`https://api.github.com/repos/${GH.owner}/${GH.repo}/${path}`, {
      ...opts,
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
      cache: "no-store",
    });
    return r;
  },

  async load(token) {
    if (GH) {
      // painel logado: lê direto do repositório (sem esperar o Pages atualizar)
      if (token) {
        const r = await this.gh(`contents/${DATA_PATH}?ref=${GH.branch}`, {}, token);
        if (r.ok) { const j = await r.json(); this._sha = j.sha; return normalize(JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))))); }
      }
      try {
        const r = await fetch(`${ROOT}${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" });
        if (r.ok) return normalize(await r.json());
      } catch (_) {}
      return normalize(await this.seed());
    }
    try {
      const r = await fetch(`${ROOT}api/data`, { cache: "no-store" });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error("no api");
      const j = await r.json();
      this.mode = "remote";
      if (j && Array.isArray(j.products)) return normalize(j);
      return normalize(await this.seed());
    } catch (_) {
      this.mode = "local";
      const saved = localStorage.getItem(LS_DATA);
      if (saved) { try { return normalize(JSON.parse(saved)); } catch (_) {} }
      try { const r = await fetch(`${ROOT}${DATA_PATH}`, { cache: "no-store" }); if (r.ok) return normalize(await r.json()); } catch (_) {}
      return normalize(await this.seed());
    }
  },

  async seed() {
    const r = await fetch(`${ROOT}data/seed.json`, { cache: "no-store" });
    return r.json();
  },

  async checkPassword(pw) {
    if (this.mode === "github") {
      if (!pw) return false;
      const r = await this.gh("", {}, pw);
      if (!r.ok) return false;
      const j = await r.json();
      return Boolean(j.permissions && j.permissions.push);
    }
    if (this.mode !== "remote") return true;
    const r = await fetch(`${ROOT}api/data?auth=1`, { headers: { "x-admin-password": pw } });
    return r.ok;
  },

  async save(data, pw) {
    data.updatedAt = new Date().toISOString();
    if (this.mode === "github") {
      const put = () => this.gh(`contents/${DATA_PATH}`, {
        method: "PUT",
        body: JSON.stringify({ message: "Painel: atualiza produtos", content: b64(JSON.stringify(data, null, 1)), branch: GH.branch, ...(this._sha ? { sha: this._sha } : {}) }),
      }, pw);
      let r = await put();
      if (r.status === 409 || r.status === 422) { // sha desatualizado: busca o atual e tenta de novo
        const cur = await this.gh(`contents/${DATA_PATH}?ref=${GH.branch}`, {}, pw);
        this._sha = cur.ok ? (await cur.json()).sha : undefined;
        r = await put();
      }
      if (r.status === 401 || r.status === 403) throw new Error("Senha incorreta");
      if (!r.ok) throw new Error("Não foi possível salvar. Tente de novo.");
      this._sha = (await r.json()).content.sha;
      return;
    }
    if (this.mode === "remote") {
      const r = await fetch(`${ROOT}api/data`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-password": pw },
        body: JSON.stringify(data),
      });
      if (r.status === 401) throw new Error("Senha incorreta");
      if (!r.ok) throw new Error("Não foi possível salvar. Tente de novo.");
    } else {
      try { localStorage.setItem(LS_DATA, JSON.stringify(data)); }
      catch (_) { throw new Error("Memória do navegador cheia (modo de teste). Use menos fotos."); }
    }
  },

  async upload(blob, pw) {
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    if (this.mode === "github") {
      const path = `img/produtos/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const r = await this.gh(`contents/${path}`, {
        method: "PUT",
        body: JSON.stringify({ message: "Painel: nova foto", content: await blobToB64(blob), branch: GH.branch }),
      }, pw);
      if (!r.ok) throw new Error("Falha ao enviar a foto");
      // URL do arquivo no próprio repositório (aparece na hora, antes do Pages atualizar)
      return `https://raw.githubusercontent.com/${GH.owner}/${GH.repo}/${GH.branch}/${path}`;
    }
    if (this.mode === "remote") {
      const r = await fetch(`${ROOT}api/upload?ext=${ext}`, {
        method: "POST",
        headers: { "content-type": blob.type, "x-admin-password": pw },
        body: blob,
      });
      if (!r.ok) throw new Error("Falha ao enviar a foto");
      return (await r.json()).url;
    }
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  },
};

function normalize(d) {
  d = d || {};
  d.settings = Object.assign({
    storeName: "In Dress",
    whatsapp: "5527998406685",
    instagram: "use.indress",
    heroTitle: "Treine do seu jeito",
    heroText: "Moda feminina para mulheres reais: fitness, íntimo e peças que unem conforto e elegância. Escolha suas peças e finalize direto no WhatsApp.",
    categories: ["Conjuntos", "Macaquinhos", "Macacões", "Plus Size"],
    city: "",
  }, d.settings || {});
  d.products = (d.products || []).map((p) => Object.assign({
    id: uid(), name: "", price: 0, promoPrice: null, category: "", description: "",
    sizes: [], colors: [], images: [], available: true, featured: false, createdAt: new Date().toISOString(),
  }, p));
  return d;
}

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const brl = (n) => !(Number(n) > 0) ? "Sob consulta" : (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const finalPrice = (p) => (p.promoPrice && Number(p.promoPrice) > 0 && Number(p.promoPrice) < Number(p.price)) ? Number(p.promoPrice) : Number(p.price);
const isSale = (p) => p.promoPrice && Number(p.promoPrice) > 0 && Number(p.promoPrice) < Number(p.price);
const isNew = (p) => (Date.now() - new Date(p.createdAt).getTime()) < 1000 * 60 * 60 * 24 * 21;

function waLink(number, text) {
  const n = onlyDigits(number);
  const base = n ? `https://wa.me/${n}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/* Placeholder elegante enquanto não há foto */
function placeholder(seedText = "indress", i = 0) {
  const palettes = [
    ["#ffd6e0", "#ff3d71"], ["#efe7dc", "#0d0d0f"], ["#e9ffb0", "#7aa300"],
    ["#dfe6ff", "#3d5bff"], ["#ffe8d6", "#ff7a3d"], ["#e8e1f7", "#6a3dff"],
  ];
  let h = 0; for (const c of seedText) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = palettes[(h + i) % palettes.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${bg}'/><stop offset='1' stop-color='#fbf9f6'/></linearGradient></defs>
  <rect width='300' height='400' fill='url(#g)'/>
  <circle cx='${220 - (h % 80)}' cy='${110 + (h % 60)}' r='90' fill='${fg}' opacity='.12'/>
  <path d='M118 120c8-14 56-14 64 0l14 40-14 10-6-20v120h-52V150l-6 20-14-10z' fill='${fg}' opacity='.18'/>
  <text x='150' y='360' font-family='Arial Black,Arial' font-weight='900' font-size='22' text-anchor='middle' fill='${fg}' opacity='.45' letter-spacing='4'>INDRESS</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
const imgOf = (p, i = 0) => (p.images && p.images[i]) || placeholder(p.name || p.id, i);

/* Comprime foto no próprio celular antes de enviar (máx. 1400px, WebP) */
async function compressImage(file, max = 1400, quality = 0.82) {
  const bmp = await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, max / Math.max(bmp.naturalWidth, bmp.naturalHeight));
  const w = Math.round(bmp.naturalWidth * scale), h = Math.round(bmp.naturalHeight * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  URL.revokeObjectURL(bmp.src);
  let blob = await new Promise((r) => c.toBlob(r, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", quality));
  return blob;
}

function toast(msg, ms = 2400) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
}

const ICONS = {
  bag: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  close: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  search: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
  ig: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  wa: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.8 2 6.8L3 29l6.6-1.9c1.9 1 4.1 1.6 6.4 1.6 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1.1 1.1-3.8-.3-.4c-1.1-1.7-1.7-3.7-1.7-5.7C5.1 9.9 10 5.2 16 5.2s10.9 4.7 10.9 10.6S22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2s0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5s0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.7 1.2 3.1 1.4 3.4c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.3.2-1.5c-.1-.2-.3-.3-.6-.4z"/></svg>`,
};

/* foto que não carregou → placeholder bonito */
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t.tagName === "IMG" && !t.dataset.fb) { t.dataset.fb = 1; t.src = placeholder(t.alt || t.src); }
}, true);
