// functions/ws/[[path]].js — the battle rooms, reached through the API's own
// domain: wss://learn-eng-pwa-api.pages.dev/ws/room/<id>?token=… and
// /ws/offering/<room>?token=….
//
// The rooms live in a Worker (battle-worker/, a Durable Object) whose
// workers.dev address carries the account's subdomain — a personal name the
// user does not want in a public repo or a child's address bar. So the app
// never learns it: this route forwards the WebSocket upgrade over a SERVICE
// BINDING (api-project/wrangler.toml [[services]] BATTLE → learn-eng-pwa-battle),
// which is account-internal and needs no public hostname at all. The Worker
// still verifies the token and strips it before the room sees it, exactly as
// when it was reached directly; nothing here reads the token.
//
// On a deployment without the binding (the eng-pwa app, which reaches its
// own Worker directly) this route simply does not exist.
export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.BATTLE) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  const path = '/' + (Array.isArray(params.path) ? params.path.join('/') : String(params.path || ''));
  // The Worker matches on its own pathname; the host is irrelevant to it.
  const target = new URL(path + url.search, 'https://battle.internal');
  return env.BATTLE.fetch(new Request(target.toString(), request));
}
