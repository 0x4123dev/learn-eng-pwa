// A D1Database stand-in backed by Node's built-in synchronous SQLite
// (node:sqlite, Node >= 22.5). It exists so functions/api/*.js handlers can be
// EXECUTED in tests instead of substring-checked: the SQL that guards the
// children's wallets runs against a real SQLite engine, including ON CONFLICT
// upserts, RETURNING, INSERT OR IGNORE and meta.changes — the exact features
// the money paths lean on.
//
// Only the surface the handlers actually use is implemented:
//   env.DB.prepare(sql)             -> statement
//   statement.bind(...params)       -> bound statement (bind is optional)
//   bound.first()  -> row object | null          (async, like D1)
//   bound.all()    -> { results, success, meta } (async)
//   bound.run()    -> { success, meta: { changes, last_row_id } } (async)
//   env.DB.batch([bound, ...])      -> array of run() results, in ONE txn
//   env.DB.exec(sql)                -> multi-statement script (schema files)
'use strict';

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  throw new Error(
    'tests/d1-mock.js needs node:sqlite (Node >= 22.5). Current: ' + process.version
  );
}

function toMeta(info) {
  return {
    changes: Number(info && info.changes || 0),
    last_row_id: Number(info && info.lastInsertRowid || 0),
    duration: 0,
  };
}

function makeBound(db, sql, params) {
  return {
    // D1 forbids re-binding; nobody in functions/ does it either.
    bind() { throw new Error('bind() called twice for: ' + sql); },
    async first(column) {
      const row = db.prepare(sql).get(...params);
      if (row === undefined) return null;
      return column === undefined ? row : row[column];
    },
    async all() {
      const rows = db.prepare(sql).all(...params);
      return { results: rows, success: true, meta: toMeta(null) };
    },
    async run() {
      const stmt = db.prepare(sql);
      // A RETURNING statement must go through .all() in node:sqlite; D1's
      // .run() on it simply ignores the rows, so mirror that.
      if (/\bRETURNING\b/i.test(sql)) {
        const rows = stmt.all(...params);
        return { success: true, meta: { changes: rows.length, last_row_id: 0, duration: 0 } };
      }
      return { success: true, meta: toMeta(stmt.run(...params)) };
    },
  };
}

function createD1() {
  const db = new DatabaseSync(':memory:');
  const d1 = {
    prepare(sql) {
      const unbound = makeBound(db, sql, []);
      return {
        bind(...params) {
          for (const p of params) {
            if (p === undefined) throw new Error('undefined bound to: ' + sql);
          }
          return makeBound(db, sql, params);
        },
        first: unbound.first,
        all: unbound.all,
        run: unbound.run,
      };
    },
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) { db.exec(sql); },
  };
  return { db, d1 };
}

module.exports = { createD1 };
