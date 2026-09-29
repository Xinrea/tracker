import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse } from "smol-toml";
import { todayInTimeZone } from "../scripts/lib/dates.mjs";
import { listLogFiles, validateData } from "../scripts/lib/validate.mjs";

const TODAY = "2026-09-22";

function input(overrides = {}) {
  return {
    profile: {
      name: "Xinrea",
      bio: "bio",
      timezone: "Asia/Shanghai",
      week_start: "sunday",
    },
    habits: {
      habit: [
        {
          id: "read",
          name: "阅读",
          description: "阅读至少 20 分钟",
          icon: "📖",
          since: "2026-09-01",
          archived: false,
        },
      ],
    },
    template: {
      date: TODAY,
      read: { done: false, note: "" },
    },
    logs: [],
    ...overrides,
  };
}

function messages(data) {
  try {
    validateData(data, { today: TODAY });
    return [];
  } catch (error) {
    return error.messages;
  }
}

test("合法数据和 TOML 日期可以通过校验", () => {
  const parsed = parse(`
date = 2026-09-21

[read]
done = true
note = "读完一章"
`);
  const model = validateData(input({
    logs: [{ file: "2026-09-21.toml", data: parsed }],
  }), { today: TODAY });
  assert.equal(model.logs[0].date, "2026-09-21");
  assert.equal(model.logs[0].entries.read.done, true);
  assert.equal(model.profile.timezone, "Asia/Shanghai");
});

test("仓库里的 TOML 可以通过校验", () => {
  const model = validateData({
    profile: parse(fs.readFileSync("data/profile.toml", "utf8")),
    habits: parse(fs.readFileSync("data/habits.toml", "utf8")),
    template: parse(fs.readFileSync("logs/_template.toml", "utf8")),
    logs: [],
  }, { today: TODAY });
  assert.deepEqual(model.habits.map((habit) => habit.id), [
    "cook", "pullup", "pushup", "fly", "cardio", "ukulele", "ffxiv", "sf", "sleep", "wake",
  ]);
  assert.equal(model.habits[0].since, "2026-09-22");
  assert.equal(model.profile.avatar, "https://avatars.githubusercontent.com/u/13964898");
  assert.deepEqual(model.profile.reactions, ["👍", "❤️", "🔥", "🎉"]);
  assert.equal(model.profile.reactionsApi, "https://xinrea.cn/tracker/reactions");
  assert.equal(model.profile.weekStart, "sunday");
});

test("文件名和 date 不一致", () => {
  const result = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-20", read: { done: true } },
    }],
  }));
  assert.match(result.join("\n"), /文件名是 2026-09-21，但 date 是 2026-09-20/);
});

test("未知习惯", () => {
  const result = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: true }, run: { done: true } },
    }],
  }));
  assert.match(result.join("\n"), /未知习惯 run/);
});

test("缺少 done", () => {
  const result = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { note: "忘了写" } },
    }],
  }));
  assert.match(result.join("\n"), /缺少 done/);
});

test("done 不是布尔值", () => {
  const result = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: "true" } },
    }],
  }));
  assert.match(result.join("\n"), /done 必须是 true 或 false/);
});

test("模板和未停用习惯不一致", () => {
  const missing = messages(input({ template: { date: TODAY } }));
  assert.match(missing.join("\n"), /不一致：缺少 read/);

  const extra = messages(input({
    template: {
      date: TODAY,
      read: { done: false },
      run: { done: false },
    },
  }));
  assert.match(extra.join("\n"), /不一致：多了 run/);
});

test("不能记录未来，也不能早于 since", () => {
  const future = messages(input({
    logs: [{
      file: "2026-09-23.toml",
      data: { date: "2026-09-23", read: { done: true } },
    }],
  }));
  assert.match(future.join("\n"), /晚于今天/);

  const early = messages(input({
    logs: [{
      file: "2026-08-31.toml",
      data: { date: "2026-08-31", read: { done: true } },
    }],
  }));
  assert.match(early.join("\n"), /从 2026-09-01 才开始/);
});

test("completed_at 可选，本地时间会规范成 HH:MM:SS", () => {
  const parsed = parse(`
date = 2026-09-21

[read]
done = true
completed_at = 07:42:00
note = "晨读"
`);
  const model = validateData(input({
    logs: [{ file: "2026-09-21.toml", data: parsed }],
  }), { today: TODAY });
  assert.equal(model.logs[0].entries.read.completedAt, "07:42:00");

  const quoted = validateData(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: true, completed_at: "07:42" } },
    }],
  }), { today: TODAY });
  assert.equal(quoted.logs[0].entries.read.completedAt, "07:42:00");

  const empty = validateData(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: true, completed_at: "" } },
    }],
  }), { today: TODAY });
  assert.equal(empty.logs[0].entries.read.completedAt, "");

  const missing = validateData(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: true } },
    }],
  }), { today: TODAY });
  assert.equal(missing.logs[0].entries.read.completedAt, "");
});

test("非法或未完成时的 completed_at 会被拒绝", () => {
  const bad = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: true, completed_at: "7:42" } },
    }],
  }));
  assert.match(bad.join("\n"), /completed_at 必须是 profile 时区下的本地时间/);

  const zoned = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: parse(`
date = 2026-09-21

[read]
done = true
completed_at = 2026-09-21T07:42:00+08:00
`),
    }],
  }));
  assert.match(zoned.join("\n"), /completed_at 必须是 profile 时区下的本地时间/);

  const missed = messages(input({
    logs: [{
      file: "2026-09-21.toml",
      data: { date: "2026-09-21", read: { done: false, completed_at: "07:42" } },
    }],
  }));
  assert.match(missed.join("\n"), /没有完成，不能填写 completed_at/);
});

test("已有日志可以没有 completed_at", () => {
  const names = fs.readdirSync("logs").filter((name) => /^\d{4}-\d{2}-\d{2}\.toml$/.test(name));
  const model = validateData({
    profile: parse(fs.readFileSync("data/profile.toml", "utf8")),
    habits: parse(fs.readFileSync("data/habits.toml", "utf8")),
    template: parse(fs.readFileSync("logs/_template.toml", "utf8")),
    logs: names.map((file) => ({
      file,
      data: parse(fs.readFileSync(`logs/${file}`, "utf8")),
    })),
  }, { today: todayInTimeZone("Asia/Shanghai") });
  assert.ok(model.logs.length >= names.length);
  assert.ok(model.logs.some((log) => Object.values(log.entries).every((entry) => entry.completedAt === "")));
});

test("拒绝未知字段和无法识别的日志文件名", () => {
  const result = messages(input({
    profile: {
      name: "Xinrea",
      bio: "bio",
      timezone: "Asia/Shanghai",
      week_start: "Monday",
      motto: "hi",
    },
  }));
  assert.match(result.join("\n"), /未知字段 motto/);
  assert.match(result.join("\n"), /week_start 只能是 sunday 或 monday/);

  const files = listLogFiles(["notes.toml", "2026-02-31.toml"]);
  assert.match(files.errors.join("\n"), /notes\.toml 无法识别/);
  assert.match(files.errors.join("\n"), /2026-02-31\.toml 不是有效日期/);
});
