// GET  /api/data            -> dados públicos da loja (produtos + configurações)
// GET  /api/data?auth=1     -> valida a senha (header x-admin-password)
// POST /api/data            -> salva tudo (requer senha)
import { put, list, del } from "@vercel/blob";

const PREFIX = "store/data-";

function authorized(req) {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers["x-admin-password"] === pw;
}

async function latest() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  try {
    if (req.method === "GET" && req.query.auth) {
      return res.status(authorized(req) ? 200 : 401).json({ ok: authorized(req) });
    }

    if (req.method === "GET") {
      const blobs = await latest();
      if (!blobs.length) return res.status(200).json({ empty: true });
      const r = await fetch(blobs[0].url, { cache: "no-store" });
      return res.status(200).json(await r.json());
    }

    if (req.method === "POST") {
      if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.products) || typeof body.settings !== "object") {
        return res.status(400).json({ error: "invalid" });
      }
      const json = JSON.stringify({ settings: body.settings, products: body.products, updatedAt: new Date().toISOString() });
      if (json.length > 2_000_000) return res.status(413).json({ error: "too large" });

      // cada versão tem URL própria (sem problema de cache); guardamos as 5 últimas
      await put(`${PREFIX}${Date.now()}.json`, json, {
        access: "public", contentType: "application/json", addRandomSuffix: true,
      });
      const blobs = await latest();
      const old = blobs.slice(5).map((b) => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("allow", "GET, POST");
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server" });
  }
}
