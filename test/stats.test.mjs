import assert from "node:assert/strict";
import test from "node:test";
import { buildView } from "../scripts/lib/stats.mjs";

const TODAY = "2026-09-22";

function habit(overrides = {}) {
  return {
    id: "read",
    name: "阅读",
    description: "阅读至少 20 分钟",
    icon: "📖",
    since: "2026-09-01",
    archived: false,
    ...overrides,
  };
}

function model({ habits = [habit()], logs = [] } = {}) {
  return {
    profile: {
      name: "Xinrea",
      bio: "bio",
      timezone: "Asia/Shanghai",
      weekStart: "sunday",
    },
    habits,
    logs,
    today: TODAY,
  };
}

function log(date, entries) {
  return { date, entries };
}

function readHabit(view, id = "read") {
  return view.habits.find((item) => item.id === id);
}

test("今天还没记录时，连续天数从昨天往前数", () => {
  const view = buildView(model({
    logs: [
      log("2026-09-19", { read: { done: true, note: "" } }),
      log("2026-09-20", { read: { done: true, note: "" } }),
      log("2026-09-21", { read: { done: true, note: "" } }),
    ],
  }));
  const read = readHabit(view);
  assert.equal(read.currentStreak, 3);
  assert.equal(read.longestStreak, 3);
  assert.equal(view.overview.currentPerfect, 3);
  assert.equal(view.overview.todayValue, "未记录");
});

test("今天完成会把今天算进连续天数", () => {
  const view = buildView(model({
    logs: [
      log("2026-09-19", { read: { done: true, note: "" } }),
      log("2026-09-20", { read: { done: true, note: "" } }),
      log("2026-09-21", { read: { done: true, note: "" } }),
      log("2026-09-22", { read: { done: true, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).currentStreak, 4);
  assert.equal(view.overview.currentPerfect, 4);
  assert.equal(view.overview.todayValue, "1/1");
});

test("今天明确没完成时，当前连续是 0，更早的最长连续还在", () => {
  const view = buildView(model({
    logs: [
      log("2026-09-19", { read: { done: true, note: "" } }),
      log("2026-09-20", { read: { done: true, note: "" } }),
      log("2026-09-21", { read: { done: true, note: "" } }),
      log("2026-09-22", { read: { done: false, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).currentStreak, 0);
  assert.equal(readHabit(view).longestStreak, 3);
  assert.equal(view.overview.currentPerfect, 0);
  assert.equal(view.overview.longestPerfect, 3);
});

test("中间缺一天或写成 false 会打断连续", () => {
  const view = buildView(model({
    logs: [
      log("2026-09-18", { read: { done: true, note: "" } }),
      log("2026-09-19", { read: { done: true, note: "" } }),
      log("2026-09-20", { read: { done: false, note: "" } }),
      log("2026-09-21", { read: { done: true, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).currentStreak, 1);
  assert.equal(readHabit(view).longestStreak, 2);
});

test("since 之前的空白不算断签", () => {
  const view = buildView(model({
    habits: [habit({ since: "2026-09-20" })],
    logs: [
      log("2026-09-20", { read: { done: true, note: "" } }),
      log("2026-09-21", { read: { done: true, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).currentStreak, 2);
  assert.equal(readHabit(view).longestStreak, 2);
});

test("全部完成的连续天数要求每个未停用目标都完成", () => {
  const habits = [
    habit(),
    habit({ id: "exercise", name: "运动", icon: "🏃" }),
  ];
  const missed = buildView(model({
    habits,
    logs: [
      log("2026-09-20", {
        read: { done: true, note: "" },
        exercise: { done: true, note: "" },
      }),
      log("2026-09-21", {
        read: { done: true, note: "" },
        exercise: { done: false, note: "" },
      }),
    ],
  }));
  assert.equal(missed.overview.currentPerfect, 0);
  assert.equal(missed.overview.longestPerfect, 1);
  assert.equal(readHabit(missed).currentStreak, 2);

  const archived = buildView(model({
    habits: [
      habit(),
      habit({ id: "exercise", name: "运动", icon: "🏃", archived: true }),
    ],
    logs: [log("2026-09-21", { read: { done: true, note: "" } })],
  }));
  assert.equal(archived.overview.currentPerfect, 1);
});

test("停用目标的连续天数停在最后一条记录", () => {
  const view = buildView(model({
    habits: [habit({ archived: true })],
    logs: [
      log("2026-09-18", { read: { done: true, note: "" } }),
      log("2026-09-19", { read: { done: true, note: "" } }),
      log("2026-09-20", { read: { done: true, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).currentStreak, 3);
  assert.equal(readHabit(view).longestStreak, 3);
  assert.equal(view.overview.currentPerfect, 0);
});

test("近 30 天完成率不计未记录的今天", () => {
  const view = buildView(model({
    habits: [habit({ since: "2026-09-20" })],
    logs: [
      log("2026-09-20", { read: { done: true, note: "" } }),
      log("2026-09-21", { read: { done: false, note: "" } }),
    ],
  }));
  assert.equal(readHabit(view).rateLabel, "50%");
});

test("热力图强度、今天的格子和年份范围", () => {
  const habits = [
    habit({ since: "2025-12-01" }),
    habit({ id: "exercise", name: "运动", icon: "🏃", since: "2025-12-01" }),
  ];
  const view = buildView(model({
    habits,
    logs: [
      log("2026-09-20", {
        read: { done: false, note: "" },
        exercise: { done: false, note: "" },
      }),
      log("2026-09-21", {
        read: { done: true, note: "" },
        exercise: { done: false, note: "" },
      }),
    ],
  }));
  const last = view.panels[0];
  const cell = (date) => last.cells.find((item) => item.date === date);
  assert.equal(last.id, "last");
  assert.equal(last.weekCount, 53);
  assert.equal(last.cells.length, 53 * 7);
  assert.equal(cell("2026-09-22").today, true);
  assert.equal(cell("2026-09-22").row, 3);
  assert.equal(cell("2026-09-22").level, 0);
  assert.match(cell("2026-09-22").tip, /未记录/);
  assert.equal(cell("2026-09-21").level, 2);
  assert.equal(cell("2026-09-20").level, 0);
  assert.match(cell("2026-09-26").tip, /还没到/);
  assert.deepEqual(view.panels.map((panel) => panel.id), ["last", "2026", "2025"]);
  const year = view.panels.find((panel) => panel.id === "2026");
  assert.deepEqual(year.months.map((month) => month.text), [
    "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月",
  ]);
  assert.equal(year.recorded, 2);
});
