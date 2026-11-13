// POST /api/upload?ext=webp  (corpo = imagem já comprimida no navegador; requer senha)
import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

const MAX = 4 * 1024 * 1024; // 4 MB (as fotos chegam com ~150–400 KB)
const TYPES = { webp: "image/webp", jpg: "image/jpeg" };

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers["x-admin-password"] !== pw) return res.status(401).json({ error: "unauthorized" });

  const ext = TYPES[req.query.ext] ? req.query.ext : "jpg";
  try {
    const buf = await readBody(req);
    if (!buf.length) return res.status(400).json({ error: "empty" });
    const blob = await put(`produtos/foto.${ext}`, buf, {
      access: "public", contentType: TYPES[ext], addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: "upload failed" });
  }
}
