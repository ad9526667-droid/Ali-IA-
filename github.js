// Envoie le projet sur GitHub en UN commit (API Git) : peu de requêtes, quel que soit le nombre de fichiers.
import { slug, userKeys, json } from '../../lib/util.js';
export const onRequestPost = async ({ request }) => {
  const token = userKeys(request).GITHUB_TOKEN;
  if (!token) return json({ error: 'Il me faut ton token GitHub (permission repo) pour envoyer le code.', need: 'GITHUB_TOKEN' }, 412);
  let b = {}; try { b = await request.json(); } catch {}
  const { repo, files = {}, message = 'Mise à jour par Ali', isPrivate = true } = b;
  const parts = String(repo || '').split('/'), name = slug(parts.pop()), wanted = (parts.pop() || '').replace(/[^\w.-]/g, '');
  const paths = Object.keys(files).filter(p => !p.includes('..'));
  if (!name || !paths.length) return json({ error: 'Nom de dépôt ou fichiers manquants.' }, 400);
  const gh = async (p, method = 'GET', body) => {
    const r = await fetch('https://api.github.com' + p, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ali-agent', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let d = null; try { d = await r.json(); } catch {}
    return { r, d };
  };
  try {
    const me = await gh('/user'); if (!me.r.ok) throw new Error('Token GitHub invalide');
    const owner = wanted || me.d.login, base = `/repos/${owner}/${name}`;
    let info = await gh(base);
    if (info.r.status === 404 && owner !== me.d.login) throw new Error('Dépôt introuvable : ' + owner + '/' + name);
    if (info.r.status === 404) info = await gh('/user/repos', 'POST', { name, private: isPrivate, auto_init: true });
    if (!info.r.ok) throw new Error(info.d?.message || 'Création du dépôt impossible');
    const branch = info.d.default_branch;
    let ref = await gh(`${base}/git/ref/heads/${branch}`);
    for (let i = 0; i < 3 && !ref.r.ok; i++) { await new Promise(r => setTimeout(r, 1200)); ref = await gh(`${base}/git/ref/heads/${branch}`); }
    if (!ref.r.ok) throw new Error(ref.d?.message || 'Branche introuvable');
    const parent = ref.d.object.sha, cm = await gh(`${base}/git/commits/${parent}`);
    const tree = await gh(`${base}/git/trees`, 'POST', { base_tree: cm.d.tree.sha, tree: paths.map(p => ({ path: p.replace(/^\/+/, ''), mode: '100644', type: 'blob', content: String(files[p]) || '\n' })) });
    if (!tree.r.ok) throw new Error(tree.d?.message || 'Arbre Git refusé');
    const commit = await gh(`${base}/git/commits`, 'POST', { message, tree: tree.d.sha, parents: [parent] });
    if (!commit.r.ok) throw new Error(commit.d?.message || 'Commit refusé');
    const up = await gh(`${base}/git/refs/heads/${branch}`, 'PATCH', { sha: commit.d.sha });
    if (!up.r.ok) throw new Error(up.d?.message || 'Mise à jour de la branche refusée');
    return json({ url: info.d.html_url, repo: owner + '/' + name, count: paths.length });
  } catch (e) { return json({ error: e.message }, 502); }
};
