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

test("最近记录用日期标签，默认只展开最新一天", () => {
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
    logs: [
      {
        date: "2026-09-22",
        entries: { read: { done: true, note: "旧的一天" } },
      },
      {
        date: "2026-09-23",
        entries: { read: { done: false, note: "新的一天" } },
      },
    ],
    today: "2026-09-23",
  });
  const html = renderPage(view);
  assert.match(html, /class="activity-tabs" role="tablist"/);
  assert.match(html, /data-activity-tab="2026-09-23"[^>]*aria-selected="true"/);
  assert.match(html, /data-activity-tab="2026-09-22"[^>]*aria-selected="false"/);
  assert.match(html, /data-activity-panel="2026-09-23"(?![^>]*hidden)/);
  assert.match(html, /data-activity-panel="2026-09-22"[^>]*hidden/);
  assert.match(html, /新的一天/);
  assert.match(html, /旧的一天/);
  assert.equal(html.match(/class="activity-panel"/g).length, 2);
  assert.equal(html.match(/class="activity-panel"[^>]*hidden/g).length, 1);
  assert.match(html, /activityTabs\.addEventListener\("click"/);
  assert.equal(html.includes('class="event-time"'), false);
});

test("有完成时间才渲染时间，缺省或空字符串不出现时间", () => {
  const habits = [{
    id: "read",
    name: "阅读",
    description: "阅读至少 20 分钟",
    icon: "📖",
    since: "2026-09-22",
    archived: false,
  }, {
    id: "run",
    name: "跑步",
    description: "跑 3 公里",
    icon: "🏃",
    since: "2026-09-22",
    archived: false,
  }];
  const view = buildView({
    profile: {
      name: "Xinrea",
      bio: "bio",
      timezone: "Asia/Shanghai",
      weekStart: "sunday",
    },
    habits,
    logs: [{
      date: "2026-09-22",
      entries: {
        read: { done: true, note: "晨读", completedAt: "07:42:00" },
        run: { done: true, note: "", completedAt: "" },
      },
    }],
    today: "2026-09-22",
  });
  const read = view.activity[0].items.find((item) => item.name === "阅读");
  const run = view.activity[0].items.find((item) => item.name === "跑步");
  assert.equal(read.completedAt, "07:42:00");
  assert.equal(run.completedAt, "");
  assert.match(view.habits.find((habit) => habit.id === "read").recent.at(-1).tip, /完成 07:42/);
  assert.match(view.habits.find((habit) => habit.id === "run").recent.at(-1).tip, /完成$/);
  assert.match(view.panels[0].cells.find((cell) => cell.date === "2026-09-22").tip, /阅读：完成 07:42 · 晨读/);
  assert.match(view.panels[0].cells.find((cell) => cell.date === "2026-09-22").tip, /跑步：完成$/m);

  const html = renderPage(view);
  assert.match(html, /<time class="event-time" datetime="07:42:00">07:42<\/time>/);
  assert.match(html, /晨读/);
  assert.equal(html.match(/class="event-time"/g).length, 1);
  assert.equal(html.includes("event-time\"></time>"), false);
  assert.equal(html.includes("> </time>"), false);
});
