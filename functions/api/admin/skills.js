import { requireAuth, json, err } from '../_lib.js';

// Must match functions/api/skills.js MENUS: the Book units, filed as
// 'grade4' (the name js/auth.js has always uploaded them under).
const MENUS = ['grade4'];
const DAYS = new Set(['1', '7', '30', '90', '365', 'all']);

// GET /api/admin/skills?user_id=N&days=30&menu=grade4
// Aggregates session summaries on read so correcting a taxonomy label never
// requires rewriting a second daily-rollup table.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const url = new URL(request.url);
  const rawUserId = url.searchParams.get('user_id');
  const userId = rawUserId && /^\d+$/.test(rawUserId) ? Number(rawUserId) : null;
  const rawDays = url.searchParams.get('days') || '30';
  const days = DAYS.has(rawDays) ? rawDays : '30';
  const rawMenu = String(url.searchParams.get('menu') || '').toLowerCase();
  const menu = MENUS.includes(rawMenu) ? rawMenu : null;

  const where = [];
  const binds = [];
  if (userId) { where.push('r.user_id = ?'); binds.push(userId); }
  if (menu) { where.push('r.menu = ?'); binds.push(menu); }
  if (days !== 'all') { where.push("r.created_at >= datetime('now', ?)"); binds.push('-' + days + ' days'); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const sql =
    `SELECT r.menu, r.skill_key, MAX(r.skill_label) AS skill_label,
            SUM(r.attempts) AS attempts, SUM(r.correct) AS correct,
            SUM(r.wrong) AS wrong, SUM(r.skipped) AS skipped,
            SUM(r.duration_ms) AS duration_ms, COUNT(*) AS sessions,
            MAX(r.created_at) AS last_practiced
       FROM learning_skill_results r
       ${clause}
      GROUP BY r.menu, r.skill_key
      ORDER BY (1.0 * SUM(r.correct) / MAX(1, SUM(r.attempts))) ASC,
               SUM(r.attempts) DESC, r.skill_key ASC
      LIMIT 500`;

  const stmt = binds.length ? env.DB.prepare(sql).bind(...binds) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  const skills = (results || []).map(r => {
    const attempts = Number(r.attempts) || 0;
    const correct = Number(r.correct) || 0;
    // A tiny Beta(2,2) prior prevents 1/1 from being called mastery and 0/1
    // from being called a proven weakness. The UI still shows raw accuracy.
    const mastery = Math.round(((correct + 2) / (attempts + 4)) * 100);
    return {
      menu: r.menu, skillKey: r.skill_key, skillLabel: r.skill_label,
      attempts, correct, wrong: Number(r.wrong) || 0, skipped: Number(r.skipped) || 0,
      durationMs: Number(r.duration_ms) || 0, sessions: Number(r.sessions) || 0,
      accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
      mastery, evidence: attempts < 5 ? 'low' : 'enough',
      lastPracticed: r.last_practiced,
    };
  });
  return json({ skills, filters: { userId, days, menu } });
}
