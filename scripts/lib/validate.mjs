import { isValidTimeZone, normalizeDate, todayInTimeZone } from "./dates.mjs";

const HABIT_ID = /^[a-z][a-z0-9_]*$/;
const LOG_FILE = /^(\d{4}-\d{2}-\d{2})\.toml$/;
const NOTE_LIMIT = 200;

export class TrackerError extends Error {
  constructor(messages) {
    super(messages.map((message) => `错误：${message}`).join("\n"));
    this.name = "TrackerError";
    this.messages = messages;
  }
}

function isTable(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function rejectUnknown(table, allowed, where, errors) {
  for (const key of Object.keys(table)) {
    if (!allowed.has(key)) errors.push(`${where} 有未知字段 ${key}`);
  }
}

export function listLogFiles(names) {
  const errors = [];
  const files = [];
  for (const name of names) {
    if (name.startsWith(".") || name === "_template.toml") continue;
    if (!LOG_FILE.test(name)) {
      errors.push(`logs/${name} 无法识别，每日记录必须命名为 YYYY-MM-DD.toml`);
      continue;
    }
    if (!normalizeDate(name.slice(0, 10))) {
      errors.push(`logs/${name} 不是有效日期`);
      continue;
    }
    files.push(name);
  }
  return { errors, files };
}

function readProfile(input, errors) {
  if (!isTable(input)) {
    errors.push("data/profile.toml 必须是一张表");
    return null;
  }
  rejectUnknown(input, new Set(["name", "bio", "timezone", "week_start"]), "data/profile.toml", errors);
  const profile = { name: "", bio: "", timezone: "", weekStart: "sunday" };
  if (typeof input.name !== "string" || input.name.trim() === "") {
    errors.push("data/profile.toml 的 name 必须是非空字符串");
  } else {
    profile.name = input.name.trim();
  }
  if (typeof input.bio !== "string") {
    errors.push("data/profile.toml 的 bio 必须是字符串");
  } else {
    profile.bio = input.bio.trim();
  }
  if (typeof input.timezone !== "string" || !isValidTimeZone(input.timezone)) {
    errors.push("data/profile.toml 的 timezone 必须是有效的 IANA 时区，例如 Asia/Shanghai");
  } else {
    profile.timezone = input.timezone;
  }
  if (input.week_start !== "sunday" && input.week_start !== "monday") {
    errors.push("data/profile.toml 的 week_start 只能是 sunday 或 monday");
  } else {
    profile.weekStart = input.week_start;
  }
  return profile;
}

function readHabits(input, errors) {
  if (input == null || (isTable(input) && Object.keys(input).length === 0)) return [];
  if (!isTable(input)) {
    errors.push("data/habits.toml 格式不正确");
    return [];
  }
  rejectUnknown(input, new Set(["habit"]), "data/habits.toml", errors);
  if (!Object.hasOwn(input, "habit")) return [];
  if (!Array.isArray(input.habit)) {
    errors.push("data/habits.toml 的习惯必须用 [[habit]] 写成数组");
    return [];
  }
  const habits = [];
  const seen = new Set();
  input.habit.forEach((raw, index) => {
    const where = `data/habits.toml 的第 ${index + 1} 个习惯`;
    if (!isTable(raw)) {
      errors.push(`${where} 必须是一张表`);
      return;
    }
    rejectUnknown(raw, new Set(["id", "name", "description", "icon", "since", "archived"]), where, errors);
    const habit = {
      id: "",
      name: "",
      description: "",
      icon: "",
      since: "",
      archived: false,
    };
    if (typeof raw.id !== "string" || !HABIT_ID.test(raw.id) || raw.id === "date") {
      errors.push(`${where} 的 id 必须以小写字母开头，并且只包含小写字母、数字和下划线，也不能叫 date`);
    } else if (seen.has(raw.id)) {
      errors.push(`${where} 的 id「${raw.id}」重复了`);
    } else {
      seen.add(raw.id);
      habit.id = raw.id;
    }
    if (typeof raw.name !== "string" || raw.name.trim() === "") {
      errors.push(`${where} 的 name 必须是非空字符串`);
    } else {
      habit.name = raw.name.trim();
    }
    if (typeof raw.description !== "string" || raw.description.trim() === "") {
      errors.push(`${where} 的 description 必须是非空字符串`);
    } else {
      habit.description = raw.description.trim();
    }
    if (typeof raw.icon !== "string" || raw.icon.trim() === "" || raw.icon.length > 32) {
      errors.push(`${where} 的 icon 必须是一个 emoji`);
    } else {
      habit.icon = raw.icon.trim();
    }
    const since = normalizeDate(raw.since);
    if (!since) {
      errors.push(`${where} 的 since 必须是日期，例如 2026-09-22`);
    } else {
      habit.since = since;
    }
    if (typeof raw.archived !== "boolean") {
      errors.push(`${where} 的 archived 必须是 true 或 false`);
    } else {
      habit.archived = raw.archived;
    }
    if (habit.id) habits.push(habit);
  });
  return habits;
}

function readEntry(raw, where, errors) {
  if (!isTable(raw)) {
    errors.push(`${where} 必须是一张表`);
    return null;
  }
  rejectUnknown(raw, new Set(["done", "note"]), where, errors);
  if (!Object.hasOwn(raw, "done")) {
    errors.push(`${where} 缺少 done`);
    return null;
  }
  if (typeof raw.done !== "boolean") {
    errors.push(`${where} 的 done 必须是 true 或 false`);
    return null;
  }
  let note = "";
  if (Object.hasOwn(raw, "note")) {
    if (typeof raw.note !== "string") {
      errors.push(`${where} 的 note 必须是字符串`);
      return null;
    }
    if (raw.note.length > NOTE_LIMIT) {
      errors.push(`${where} 的 note 不能超过 ${NOTE_LIMIT} 字`);
      return null;
    }
    note = raw.note;
  }
  return { done: raw.done, note };
}

function habitMap(habits) {
  return new Map(habits.map((habit) => [habit.id, habit]));
}

function readTemplate(input, habits, errors) {
  if (!isTable(input)) {
    errors.push("logs/_template.toml 必须是一张表");
    return;
  }
  if (!normalizeDate(input.date)) {
    errors.push("logs/_template.toml 必须有 date，例如 date = 2026-09-22");
  }
  const active = habits.filter((habit) => !habit.archived).map((habit) => habit.id);
  const present = Object.keys(input).filter((key) => key !== "date");
  const missing = active.filter((id) => !present.includes(id));
  const extra = present.filter((id) => !active.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`缺少 ${missing.join("、")}`);
    if (extra.length > 0) parts.push(`多了 ${extra.join("、")}`);
    errors.push(`logs/_template.toml 和未停用的习惯不一致：${parts.join("，")}`);
  }
  for (const id of present) {
    if (!active.includes(id)) continue;
    readEntry(input[id], `logs/_template.toml 的 [${id}]`, errors);
  }
}

function readLogs(logs, habits, today, errors) {
  const byId = habitMap(habits);
  const seen = new Set();
  const normalized = [];
  for (const log of logs) {
    const file = `logs/${log.file}`;
    const filenameDate = log.file.slice(0, 10);
    if (seen.has(filenameDate)) {
      errors.push(`${file} 和另一份日志日期重复`);
      continue;
    }
    seen.add(filenameDate);
    if (!isTable(log.data)) {
      errors.push(`${file} 必须是一张表`);
      continue;
    }
    const date = normalizeDate(log.data.date);
    if (!date) {
      errors.push(`${file} 的 date 必须是日期，并和文件名一致`);
      continue;
    }
    if (date !== filenameDate) {
      errors.push(`${file} 的文件名是 ${filenameDate}，但 date 是 ${date}`);
    }
    if (today && date > today) {
      errors.push(`${file} 的日期 ${date} 晚于今天（${today}）`);
    }
    const entries = {};
    for (const key of Object.keys(log.data)) {
      if (key === "date") continue;
      const habit = byId.get(key);
      if (!habit) {
        errors.push(`${file} 引用了未知习惯 ${key}`);
        continue;
      }
      const entry = readEntry(log.data[key], `${file} 的 [${key}]`, errors);
      if (!entry) continue;
      if (habit.since && date < habit.since) {
        errors.push(`${file} 里的 ${key} 从 ${habit.since} 才开始，不能记在 ${date}`);
        continue;
      }
      entries[key] = entry;
    }
    normalized.push({ date, entries });
  }
  normalized.sort((a, b) => a.date.localeCompare(b.date));
  return normalized;
}

export function validateData(input, options = {}) {
  const errors = [];
  const profile = readProfile(input.profile, errors);
  const habits = readHabits(input.habits, errors);
  const today = options.today ?? (profile?.timezone ? todayInTimeZone(profile.timezone) : null);
  readTemplate(input.template, habits, errors);
  const logs = readLogs(input.logs ?? [], habits, today, errors);
  if (errors.length > 0) throw new TrackerError(errors);
  return { profile, habits, logs, today };
}
