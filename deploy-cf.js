// Déploie le projet sur Cloudflare Workers (fichiers + fonctions api/ + variables chiffrées),
// avec le token et l'Account ID Cloudflare de l'utilisateur.
import { slug, userKeys, json } from '../../lib/util.js';
const SHIM = String.raw`
const TYPES = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml', webmanifest: 'application/manifest+json' };
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname.slice(1);
    if (path.startsWith('api/')) {
      const key = path.slice(4).endsWith('/') ? path.slice(4, -1) : path.slice(4), fn = FNS[key];
      const J = { 'content-type': 'application/json' };
      if (!fn) return new Response('{"error":"API introuvable"}', { status: 404, headers: J });
      const mod = { exports: {} };
      fn(mod, mod.exports, { env }, n => { throw new Error('require(' + n + ') indisponible'); });
      const h = mod.exports.default || mod.exports;
      const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
      let body = text; if ((request.headers.get('content-type') || '').includes('json') && text) { try { body = JSON.parse(text); } catch (e) {} }
      return new Promise(async resolve => {
        let status = 200; const headers = {}, done = b => resolve(new Response(b == null ? '' : String(b), { status, headers }));
        const res = {
          status(c) { status = c; return res; }, setHeader(k, v) { headers[k] = v; return res; },
          json(o) { headers['content-type'] = 'application/json'; done(JSON.stringify(o)); return res; },
          send(b) { if (b && typeof b === 'object') { headers['content-type'] = 'application/json'; b = JSON.stringify(b); } done(b); return res; },
          end(b) { done(b); return res; },
        };
        try { await h({ method: request.method, headers: Object.fromEntries(request.headers), body, query: Object.fromEntries(url.searchParams), url: url.pathname + url.search }, res); setTimeout(() => done(''), 5000); }
        catch (e) { status = 500; headers['content-type'] = 'application/json'; done(JSON.stringify({ error: String(e.message || e) })); }
      });
    }
    const f = FILES[path === '' || path.endsWith('/') ? path + 'index.html' : path];
    if (f === undefined) return new Response('Introuvable', { status: 404 });
    const ext = (path === '' ? 'html' : path.split('.').pop());
    return new Response(f, { headers: { 'content-type': (TYPES[ext] || 'text/html') + '; charset=utf-8' } });
  },
};
`;
export const onRequestPost = async ({ request }) => {
  const K = userKeys(request), token = K.CLOUDFLARE_API_TOKEN, acc = K.CLOUDFLARE_ACCOUNT_ID;
  if (!token) return json({ error: 'Il me faut ton token API Cloudflare (permission Workers Scripts : Edit).', need: 'CLOUDFLARE_API_TOKEN' }, 412);
  if (!acc) return json({ error: 'Il me faut l’identifiant de ton compte Cloudflare (Account ID).', need: 'CLOUDFLARE_ACCOUNT_ID' }, 412);
  let b = {}; try { b = await request.json(); } catch {}
  const { name, files = {}, env = {} } = b, script = 'ali-' + (slug(name) || 'projet');
  const stat = {}, api = {};
  for (const [p, c] of Object.entries(files)) {
    if (p.includes('..')) continue;
    const q = p.replace(/^\/+/, '');
    if (/^api\/.+\.js$/.test(q)) api[q.slice(4).replace(/(\/index)?\.js$/, '')] = String(c); else stat[q] = String(c);
  }
  if (!Object.keys(stat).length && !Object.keys(api).length) return json({ error: 'Aucun fichier à déployer.' }, 400);
  const fns = Object.entries(api).map(([k, src]) => `${JSON.stringify(k)}: (module, exports, process, require) => {\n${src}\n}`).join(',\n');
  const code = `const FILES = ${JSON.stringify(stat)};\nconst FNS = {${fns}};\n` + SHIM;
  const bindings = Object.entries(env).filter(([k, v]) => /^[A-Z_][A-Z0-9_]{0,63}$/.test(k) && typeof v === 'string' && v).map(([n, text]) => ({ type: 'secret_text', name: n, text }));
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify({ main_module: 'worker.js', compatibility_date: '2025-09-01', bindings })], { type: 'application/json' }));
  fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  const H = { Authorization: `Bearer ${token}` }, base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(acc)}/workers`;
  try {
    const up = await fetch(`${base}/scripts/${script}`, { method: 'PUT', headers: H, body: fd }), ud = await up.json().catch(() => ({}));
    if (!up.ok) throw new Error(ud.errors?.[0]?.message || 'Envoi vers Cloudflare refusé (' + up.status + ')');
    await fetch(`${base}/scripts/${script}/subdomain`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) }).catch(() => {});
    const sd = await (await fetch(`${base}/subdomain`, { headers: H })).json().catch(() => ({})), sub = sd.result?.subdomain;
    if (!sub) return json({ url: 'https://dash.cloudflare.com', secrets: bindings.length });
    return json({ url: `https://${script}.${sub}.workers.dev`, secrets: bindings.length });
  } catch (e) { return json({ error: e.message }, 502); }
};
