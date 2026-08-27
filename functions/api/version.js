import { json } from './_lib.js';

// Static assets and the Functions bundle propagate to the production domain
// INDEPENDENTLY. A deploy once reported "live" because index.html had the new
// version, while /api/register was still running the previous build and still
// rejecting the very name the deploy was meant to fix.
//
// scripts/deploy.sh polls this endpoint until it matches the version it just
// shipped, so "live" means the API too — not just the HTML.
// Kept in sync automatically by the bump step in scripts/deploy.sh.
const VERSION = '4.14.94';

export async function onRequestGet() {
  return json({ version: VERSION });
}
