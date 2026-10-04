// Importe un dépôt GitHub (fichiers texte uniquement) dans un projet Ali.
import { slug, userKeys, json } from '../../lib/util.js';
const TEXT = /\.(html?|css|js|mjs|cjs|json|md|txt|svg|ts|tsx|jsx|vue|py|yml|yaml|toml|xml|webmanifest)$/i;
export const onRequestPost = async ({ request }) => {
  let b = {}; try { b = await request.json(); } catch {}
  const m = String(b.repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '').match(/^([\w.-]+)\/([\w.-]+)/);
  if (!m) return json({ error: 'Indique le dépôt sous la forme proprietaire/nom.' }, 400);
  const [, owner, repo] = m, token = userKeys(request).GITHUB_TOKEN;
  const gh = (p, raw) => fetch('https://api.github.com' + p, { headers: { Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'User-Agent': 'ali-agent', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  try {
    const info = await gh(`/repos/${owner}/${repo}`), ij = await info.json();
    if (!info.ok) throw new Error(info.status === 404 ? 'Dépôt introuvable (privé ? ajoute ton token GitHub dans Mes clés).' : ij.message);
    const t = await gh(`/repos/${owner}/${repo}/git/trees/${ij.default_branch}?recursive=1`), tj = await t.json();
    if (!t.ok) throw new Error(tj.message || 'Lecture du dépôt impossible');
    const all = (tj.tree || []).filter(x => x.type === 'blob' && TEXT.test(x.path) && x.size <= 100000 && !/(^|\/)(node_modules|\.git|dist|build)\//.test(x.path) && !/package-lock\.json$/.test(x.path));
    const pick = all.slice(0, 40), files = {};
    for (let i = 0; i < pick.length; i += 8) {
      await Promise.all(pick.slice(i, i + 8).map(async x => {
        const r = await gh(`/repos/${owner}/${repo}/contents/${encodeURI(x.path)}?ref=${ij.default_branch}`, true);
        if (r.ok) files[x.path] = await r.text();
      }));
    }
    return json({ name: slug(repo), repo: owner + '/' + repo, files, total: all.length, kept: Object.keys(files).length });
  } catch (e) { return json({ error: e.message }, 502); }
};
