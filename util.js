// Aucune base de données ni variable d'environnement : les clés de chaque utilisateur
// arrivent dans l'en-tête x-ali-keys, servent à la requête, puis sont oubliées.
export const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
export const userKeys = request => {
  try {
    const raw = atob(request.headers.get('x-ali-keys') || ''), j = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)))), o = {};
    for (const [k, v] of Object.entries(j)) if (/^[A-Z_][A-Z0-9_]{0,63}$/.test(k) && typeof v === 'string') o[k] = v.slice(0, 500);
    return o;
  } catch { return {}; }
};
