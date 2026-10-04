// Recherche web (Gemini + Google Search) avec la clé Gemini de l'utilisateur.
import { userKeys, json } from '../../lib/util.js';
export const onRequestPost = async ({ request }) => {
  const K = userKeys(request);
  if (!K.GEMINI_API_KEY) return json({ error: 'Il me faut une clé Gemini pour chercher sur le web.', need: 'GEMINI_API_KEY' }, 412);
  let b = {}; try { b = await request.json(); } catch {}
  const q = String(b.query || '').slice(0, 500);
  if (!q) return json({ error: 'Question vide.' }, 400);
  const model = K.GEMINI_MODEL || 'gemini-3.8-flash';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': K.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Cherche sur le web les informations techniques à jour utiles pour réaliser ceci : ${q}\nRésume en 150 mots maximum, en français : API ou syntaxe à utiliser, bonnes pratiques, pièges.` }] }],
        tools: [{ google_search: {} }],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Erreur Gemini');
    const c = d.candidates?.[0];
    return json({
      notes: (c?.content?.parts || []).map(p => p.text || '').join(''),
      sources: (c?.groundingMetadata?.groundingChunks || []).map(x => x.web).filter(Boolean).slice(0, 4).map(w => ({ title: w.title, url: w.uri })),
    });
  } catch (e) { return json({ error: e.message }, 502); }
};
