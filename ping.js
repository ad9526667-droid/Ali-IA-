import { json } from '../../lib/util.js';
export const onRequest = ({ env }) => json({ ok: true, runtime: 'cloudflare', ai: !!(env && env.AI) });
