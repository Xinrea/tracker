import assert from "node:assert/strict";
import test from "node:test";
import { handle } from "../src/index.js";

const VISITOR = "11111111-1111-4111-8111-111111111111";
const ALLOWED = "👍,❤️,🔥,🎉";

function createDb() {
  const reactions = new Map();
  const votes = new Set();
  const rates = new Map();
  return {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) {
          statement.args = args;
          return statement;
        },
        async first() {
          if (sql.includes("FROM rate_limits")) return rates.get(statement.args[0]) ?? null;
          return null;
        },
        async all() {
          return {
            results: [...reactions.entries()].map(([emoji, count]) => ({ emoji, count })),
          };
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO votes")) {
            const key = `${statement.args[0]}\0${statement.args[1]}`;
            if (votes.has(key)) return { meta: { changes: 0 } };
            votes.add(key);
            return { meta: { changes: 1 } };
          }
          if (sql.includes("DELETE FROM votes")) {
            const key = `${statement.args[0]}\0${statement.args[1]}`;
            if (!votes.has(key)) return { meta: { changes: 0 } };
            votes.delete(key);
            return { meta: { changes: 1 } };
          }
          if (sql.includes("count = count + 1")) {
            const emoji = statement.args[0];
            reactions.set(emoji, (reactions.get(emoji) ?? 0) + 1);
            return { meta: { changes: 1 } };
          }
          if (sql.includes("MAX(count - 1, 0)")) {
            const emoji = statement.args[0];
            reactions.set(emoji, Math.max((reactions.get(emoji) ?? 0) - 1, 0));
            return { meta: { changes: 1 } };
          }
          if (sql.includes("INSERT INTO rate_limits")) {
            rates.set(statement.args[0], { window_start: statement.args[1], hits: 1 });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("UPDATE rate_limits")) {
            rates.get(statement.args[0]).hits += 1;
            return { meta: { changes: 1 } };
          }
          throw new Error(`未模拟的 SQL：${sql}`);
        },
      };
      return statement;
    },
  };
}

function env() {
  return { DB: createDb(), ALLOWED, IP_SALT: "test-salt" };
}

function post(payload, origin = "https://xinrea.cn") {
  return new Request("https://xinrea.cn/tracker/reactions", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
    body: JSON.stringify(payload),
  });
}

test("点一次加一，再点取消", async () => {
  const database = env();
  const added = await handle(post({ emoji: "👍", action: "add", visitor: VISITOR }), database, 1_000);
  assert.equal(added.status, 200);
  assert.equal((await added.json()).counts["👍"], 1);

  const again = await handle(post({ emoji: "👍", action: "add", visitor: VISITOR }), database, 2_000);
  assert.equal((await again.json()).counts["👍"], 1);

  const removed = await handle(post({ emoji: "👍", action: "remove", visitor: VISITOR }), database, 3_000);
  assert.equal((await removed.json()).counts["👍"], 0);
});

test("拒绝未知表情和其他网站", async () => {
  const database = env();
  const unknown = await handle(post({ emoji: "💀", action: "add", visitor: VISITOR }), database, 1_000);
  assert.equal(unknown.status, 400);

  const foreign = await handle(
    post({ emoji: "👍", action: "add", visitor: VISITOR }, "https://example.com"),
    database,
    1_000,
  );
  assert.equal(foreign.status, 403);
});

test("同一地址一小时内最多 30 次", async () => {
  const database = env();
  let status = 200;
  for (let index = 0; index < 31; index += 1) {
    const response = await handle(
      post({ emoji: "🔥", action: "add", visitor: VISITOR }),
      database,
      10_000,
    );
    status = response.status;
  }
  assert.equal(status, 429);
});
