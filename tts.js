// Voix : Microsoft Edge (WebSocket) en premier, Workers AI (melotts) en secours, sinon la page utilise la voix du navigateur.
import { json } from '../../lib/util.js';
const VOICES = ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural', 'fr-FR-EloiseNeural', 'fr-CA-SylvieNeural', 'fr-BE-CharlineNeural'];
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
async function gec() {
  let t = Math.floor(Date.now() / 1000) + 11644473600; t -= t % 300; t *= 1e7;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t + TOKEN));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
async function edge(text, voice, rate) {
  const id = crypto.randomUUID().replace(/-/g, '');
  const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${await gec()}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${id}`;
  const r = await fetch(url, { headers: { Upgrade: 'websocket', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold' } });
  const ws = r.webSocket; if (!ws) throw new Error('Voix Edge indisponible');
  ws.accept(); try { ws.binaryType = 'arraybuffer'; } catch {}
  return new Promise((ok, ko) => {
    const chunks = [], timer = setTimeout(() => { try { ws.close(); } catch {} ko(new Error('délai')); }, 15000);
    ws.addEventListener('message', e => {
      if (typeof e.data === 'string') { if (e.data.includes('Path:turn.end')) { clearTimeout(timer); ws.close(); chunks.length ? ok(new Blob(chunks, { type: 'audio/mpeg' })) : ko(new Error('vide')); } return; }
      const buf = new Uint8Array(e.data), hl = (buf[0] << 8) | buf[1];
      if (new TextDecoder().decode(buf.subarray(2, 2 + hl)).includes('Path:audio')) chunks.push(buf.subarray(2 + hl));
    });
    ws.addEventListener('error', () => { clearTimeout(timer); ko(new Error('erreur Edge')); });
    const ts = new Date().toString();
    ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
    ws.send(`X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${esc(text)}</prosody></voice></speak>`);
  });
}
export const onRequestPost = async ({ request, env }) => {
  let b = {}; try { b = await request.json(); } catch {}
  const text = String(b.text || '').slice(0, 600);
  if (!text) return json({ error: 'Texte vide' }, 400);
  const voice = VOICES.includes(b.voice) ? b.voice : VOICES[0], rate = /^[+-]\d{1,2}%$/.test(String(b.rate)) ? b.rate : '+0%';
  try { return new Response(await edge(text, voice, rate), { headers: { 'content-type': 'audio/mpeg' } }); } catch {}
  if (env && env.AI) {
    try {
      const r = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang: 'fr' });
      return new Response(Uint8Array.from(atob(r.audio), c => c.charCodeAt(0)), { headers: { 'content-type': 'audio/mpeg' } });
    } catch {}
  }
  return json({ error: 'Voix indisponible' }, 502);
};
