// Ulazna tačka za Cloudflare Workers (wrangler deploy).
// Koristi iste funkcije kao Cloudflare Pages (folder functions/), pa projekat radi na oba načina.
import * as middleware from './functions/_middleware.js';
import * as index from './functions/index.js';
import * as panel from './functions/panel.js';
import * as prijava from './functions/prijava.js';
import * as odjava from './functions/odjava.js';
import * as admin from './functions/admin.js';

const ROUTES = { '/': index, '/panel': panel, '/prijava': prijava, '/odjava': odjava, '/admin': admin };

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const mod = ROUTES[path];
    const next = async () => {
      if (!mod) return env.ASSETS.fetch(request);
      const m = request.method.toUpperCase();
      const handler = mod['onRequest' + m[0] + m.slice(1).toLowerCase()] || mod.onRequest;
      if (!handler) return new Response('Method Not Allowed', { status: 405 });
      return handler({ request, env, ctx, waitUntil: p => ctx.waitUntil(p), next: () => env.ASSETS.fetch(request) });
    };
    return middleware.onRequest({ request, env, ctx, next });
  },
};
