const ALLOWED_ORIGINS = new Set([
  "https://xinrea.cn",
  "http://xinrea.cn",
  "https://www.xinrea.cn",
  "https://xinrea.github.io",
]);

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT = 30;

function allowedList(env) {
  return new Set(
    String(env.ALLOWED ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function allowOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function json(body, status, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function hashIp(ip, salt) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt ?? ""}:${ip}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function countsFor(env, allowed) {
  const rows = await env.DB.prepare("SELECT emoji, count FROM reactions").all();
  const counts = {};
  for (const emoji of allowed) counts[emoji] = 0;
  for (const row of rows.results ?? []) {
    if (allowed.has(row.emoji)) counts[row.emoji] = Number(row.count) || 0;
  }
  return counts;
}

async function withinRateLimit(env, ipHash, now) {
  const windowStart = Math.floor(now / HOUR_MS);
  const row = await env.DB.prepare(
    "SELECT window_start, hits FROM rate_limits WHERE ip_hash = ?",
  ).bind(ipHash).first();
  if (!row || Number(row.window_start) !== windowStart) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (ip_hash, window_start, hits) VALUES (?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_start = excluded.window_start, hits = 1",
    ).bind(ipHash, windowStart).run();
    return true;
  }
  if (Number(row.hits) >= RATE_LIMIT) return false;
  await env.DB.prepare(
    "UPDATE rate_limits SET hits = hits + 1 WHERE ip_hash = ?",
  ).bind(ipHash).run();
  return true;
}

async function applyVote(env, visitor, emoji, action) {
  if (action === "add") {
    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO votes (visitor, emoji) VALUES (?, ?)",
    ).bind(visitor, emoji).run();
    if (inserted.meta.changes === 1) {
      await env.DB.prepare(
        "INSERT INTO reactions (emoji, count) VALUES (?, 1) ON CONFLICT(emoji) DO UPDATE SET count = count + 1",
      ).bind(emoji).run();
    }
    return;
  }
  const deleted = await env.DB.prepare(
    "DELETE FROM votes WHERE visitor = ? AND emoji = ?",
  ).bind(visitor, emoji).run();
  if (deleted.meta.changes === 1) {
    await env.DB.prepare(
      "UPDATE reactions SET count = MAX(count - 1, 0) WHERE emoji = ?",
    ).bind(emoji).run();
  }
}

export async function handle(request, env, now = Date.now()) {
  const origin = allowOrigin(request.headers.get("origin"));
  if (request.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      },
    });
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && !origin) return json({ error: "origin" }, 403, null);

  const allowed = allowedList(env);
  if (request.method === "GET") {
    return json({ counts: await countsFor(env, allowed) }, 200, origin);
  }
  if (request.method !== "POST") return json({ error: "method" }, 405, origin);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(ip, env.IP_SALT);
  if (!(await withinRateLimit(env, ipHash, now))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  let payload;
  try {
    const text = await request.text();
    if (text.length > 1000) return json({ error: "body" }, 400, origin);
    payload = JSON.parse(text);
  } catch {
    return json({ error: "body" }, 400, origin);
  }
  const emoji = typeof payload.emoji === "string" ? payload.emoji : "";
  const action = payload.action;
  const visitor = typeof payload.visitor === "string" ? payload.visitor : "";
  if (!allowed.has(emoji) || (action !== "add" && action !== "remove") || !VISITOR_ID.test(visitor)) {
    return json({ error: "invalid" }, 400, origin);
  }

  await applyVote(env, visitor, emoji, action);
  return json({ counts: await countsFor(env, allowed), voted: action === "add" }, 200, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      console.log(JSON.stringify({
        message: "reaction request failed",
        error: error instanceof Error ? error.message : "unknown",
      }));
      const origin = allowOrigin(request.headers.get("origin"));
      return json({ error: "server" }, 500, origin);
    }
  },
};
