import assert from "node:assert/strict";
import test from "node:test";
import { renderPage } from "../scripts/lib/render.mjs";
import { buildView } from "../scripts/lib/stats.mjs";

test("笔记里的 HTML 会被转义", () => {
  const view = buildView({
    profile: {
      name: "Xinrea",
      bio: "bio",
      timezone: "Asia/Shanghai",
      weekStart: "sunday",
    },
    habits: [{
      id: "read",
      name: "阅读",
      description: "阅读至少 20 分钟",
      icon: "📖",
      since: "2026-09-22",
      archived: false,
    }],
    logs: [{
      date: "2026-09-22",
      entries: {
        read: { done: true, note: "<script>alert(1)</script>" },
      },
    }],
    today: "2026-09-22",
  });
  const html = renderPage(view, { basePath: "/tracker" });
  assert.equal(html.includes("<script>alert"), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<base href="\/tracker\/">/);
});
