// functions/api/_middleware.js — CORS for the API when the app is served from
// another origin.
//
// On Cloudflare Pages the app and /api/* share an origin and this never
// fires. The GitHub Pages app (https://0x4123dev.github.io/learn-eng-pwa/)
// calls the learn-eng-pwa-api project cross-origin (js/hosting.js), so the
// browser sends a preflight for every JSON POST and every Authorization
// header, and reads no response without an Access-Control-Allow-Origin.
//
// Only the origins listed here are granted, and the header echoes exactly
// the one that asked — never '*'. Tokens ride in the Authorization header
// (functions/api/_lib.js bearer()), never in cookies, so there is nothing
// credentialed to allow and nothing an unlisted origin can make a browser
// send on a child's behalf. Same-origin requests carry no Origin header (or
// their own) and pass through untouched.
export const ALLOWED_ORIGINS = Object.freeze([
  'https://0x4123dev.github.io',
  // Local development: `python3 -m http.server 8000` for the page against a
  // `wrangler pages dev` API.
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

export function corsHeadersFor(origin) {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    // The cache must key on Origin, or one origin's answer is replayed to another.
    'Vary': 'Origin',
  };
}

export async function onRequest(context) {
  const { request, next } = context;
  const origin = request.headers.get('Origin');
  const cors = corsHeadersFor(origin);
  if (request.method === 'OPTIONS') {
    // A preflight from an unlisted origin gets a bare 204 with no grant, and
    // the browser refuses the real request for us.
    return new Response(null, { status: 204, headers: cors || {} });
  }
  const response = await next();
  if (!cors) return response;
  // Response headers from a handler are immutable; copy the body across.
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}
