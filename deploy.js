// Déploie le projet sur Vercel avec le token de l'utilisateur et applique ses variables.
import { slug, userKeys, json } from '../../lib/util.js';
export const onRequestPost = async ({ request }) => {
  const K = userKeys(request), token = K.VERCEL_TOKEN;
  if (!token) return json({ error: 'Il me faut ton token Vercel pour déployer.', need: 'VERCEL_TOKEN' }, 412);
  let b = {}; try { b = await request.json(); } catch {}
  const { name, files = {}, env = {} } = b;
  const list = Object.entries(files).filter(([p]) => !p.includes('..')).map(([p, c]) => ({ file: p.replace(/^\/+/, ''), data: String(c) }));
  if (!list.length) return json({ error: 'Aucun fichier à déployer.' }, 400);
  const project = 'ali-' + (slug(name) || 'projet');
  const tq = K.VERCEL_TEAM_ID ? 'teamId=' + encodeURIComponent(K.VERCEL_TEAM_ID) : '';
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const deploy = async () => {
    const r = await fetch('https://api.vercel.com/v13/deployments?' + tq, { method: 'POST', headers: H, body: JSON.stringify({ name: project, files: list, target: 'production', projectSettings: { framework: null } }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Déploiement refusé');
    return d;
  };
  const envs = Object.entries(env).filter(([k, v]) => /^[A-Z_][A-Z0-9_]{0,63}$/.test(k) && typeof v === 'string' && v).map(([key, value]) => ({ key, value, type: 'encrypted', target: ['production', 'preview'] }));
  try {
    let d = await deploy();
    if (envs.length) {
      const e = await fetch(`https://api.vercel.com/v10/projects/${project}/env?upsert=true&${tq}`, { method: 'POST', headers: H, body: JSON.stringify(envs) });
      if (!e.ok) throw new Error('Variables non appliquées : ' + ((await e.json().catch(() => ({}))).error?.message || e.status));
      d = await deploy();
    }
    return json({ url: 'https://' + d.url, secrets: envs.length });
  } catch (e) { return json({ error: e.message }, 502); }
};
