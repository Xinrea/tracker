import { addDays, dayIndex, eachDate, formatChineseDate, weekStartOf } from "./dates.mjs";

const STATE_LABEL = {
  done: "完成",
  miss: "未完成",
  absent: "未填写",
  unlogged: "未记录",
  before: "还没开始",
  future: "还没到",
  inactive: "已停用",
};

function levelFor(done, expected, hasFile) {
  if (!hasFile || expected === 0 || done <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((done / expected) * 4)));
}

function countBack(end, minDate, isDone) {
  let streak = 0;
  let cursor = end;
  while (cursor >= minDate && isDone(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestRun(start, end, skipTrailingUnlogged, isDone, isUnlogged) {
  if (!start || !end || start > end) return 0;
  let best = 0;
  let run = 0;
  for (const date of eachDate(start, end)) {
    if (skipTrailingUnlogged && date === end && isUnlogged(date)) break;
    if (isDone(date)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function buildView(model) {
  const { profile, habits, logs, today } = model;
  const logByDate = new Map(logs.map((log) => [log.date, log]));
  const active = habits.filter((habit) => !habit.archived);
  const earliest = habits.reduce((min, habit) => (min === null || habit.since < min ? habit.since : min), null);

  const lastEntry = new Map();
  for (const habit of habits) {
    let last = null;
    for (const log of logs) {
      if (log.entries[habit.id] && (last === null || log.date > last)) last = log.date;
    }
    lastEntry.set(habit.id, last);
  }

  function entryState(habit, date) {
    if (date > today) return "future";
    if (date < habit.since) return "before";
    if (habit.archived) {
      const last = lastEntry.get(habit.id);
      if (!last || date > last) return "inactive";
    }
    const log = logByDate.get(date);
    if (!log) return "unlogged";
    const entry = log.entries[habit.id];
    if (!entry) return "absent";
    return entry.done ? "done" : "miss";
  }

  function habitsOnDay(date) {
    return habits.filter((habit) => {
      if (date < habit.since || date > today) return false;
      if (!habit.archived) return true;
      const last = lastEntry.get(habit.id);
      return Boolean(last) && date <= last;
    });
  }

  function isPerfect(date) {
    const expected = active.filter((habit) => habit.since <= date);
    if (expected.length === 0) return false;
    const log = logByDate.get(date);
    if (!log) return false;
    return expected.every((habit) => log.entries[habit.id]?.done === true);
  }

  function currentStreak(habit) {
    if (habit.archived) {
      const end = lastEntry.get(habit.id);
      if (!end) return 0;
      return countBack(end, habit.since, (date) => entryState(habit, date) === "done");
    }
    const todayState = entryState(habit, today);
    if (todayState === "before") return 0;
    if (todayState !== "done" && todayState !== "unlogged") return 0;
    const end = todayState === "done" ? today : addDays(today, -1);
    if (end < habit.since) return 0;
    return countBack(end, habit.since, (date) => entryState(habit, date) === "done");
  }

  function longestStreak(habit) {
    const end = habit.archived ? lastEntry.get(habit.id) : today;
    return longestRun(
      habit.since,
      end,
      !habit.archived,
      (date) => entryState(habit, date) === "done",
      (date) => entryState(habit, date) === "unlogged",
    );
  }

  function completionRate(habit) {
    let end = today;
    if (habit.archived) {
      end = lastEntry.get(habit.id);
      if (!end) return null;
    } else if (entryState(habit, today) === "unlogged") {
      end = addDays(today, -1);
    }
    const from = addDays(today, -29) > habit.since ? addDays(today, -29) : habit.since;
    if (from > end) return null;
    let total = 0;
    let done = 0;
    for (const date of eachDate(from, end)) {
      total += 1;
      if (entryState(habit, date) === "done") done += 1;
    }
    return total === 0 ? null : done / total;
  }

  const activeStart = active.reduce((min, habit) => (min === null || habit.since < min ? habit.since : min), null);
  let currentPerfect = 0;
  let longestPerfect = 0;
  if (activeStart) {
    const todayPerfect = isPerfect(today);
    const todayUnlogged = !logByDate.has(today);
    if (todayPerfect || todayUnlogged) {
      const end = todayPerfect ? today : addDays(today, -1);
      if (end >= activeStart) currentPerfect = countBack(end, activeStart, isPerfect);
    }
    longestPerfect = longestRun(activeStart, today, true, isPerfect, (date) => !logByDate.has(date));
  }

  const expectedToday = active.filter((habit) => habit.since <= today);
  const todayLog = logByDate.get(today);
  const todayDone = expectedToday.filter((habit) => todayLog?.entries[habit.id]?.done === true).length;

  function tooltip(date) {
    const title = formatChineseDate(date);
    if (date > today) return `${title}\n还没到`;
    if (habits.length === 0 || habits.every((habit) => date < habit.since)) return `${title}\n还没开始追踪`;
    const log = logByDate.get(date);
    const visible = habitsOnDay(date);
    if (!log) return `${title}\n未记录`;
    const lines = [title];
    let done = 0;
    for (const habit of visible) {
      const entry = log.entries[habit.id];
      const note = entry?.note ? ` · ${entry.note}` : "";
      if (!entry) lines.push(`${habit.icon} ${habit.name}：未填写`);
      else if (entry.done) {
        done += 1;
        lines.push(`${habit.icon} ${habit.name}：完成${note}`);
      } else {
        lines.push(`${habit.icon} ${habit.name}：未完成${note}`);
      }
    }
    lines.push(`${done}/${visible.length} 完成`);
    return lines.join("\n");
  }

  function buildCells(gridStart, gridEnd) {
    const cells = [];
    let col = 1;
    for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
      const row = dayIndex(date, profile.weekStart) + 1;
      const visible = date <= today ? habitsOnDay(date) : [];
      const log = logByDate.get(date);
      const done = visible.filter((habit) => log?.entries[habit.id]?.done === true).length;
      cells.push({
        date,
        row,
        col,
        level: levelFor(done, visible.length, Boolean(log)),
        tip: tooltip(date),
        today: date === today,
        hasFile: Boolean(log),
      });
      if (row === 7) col += 1;
    }
    if (cells.length % 7 !== 0) throw new Error("热力图周列没有对齐");
    return { cells, weekCount: cells.length / 7 };
  }

  function monthLabels(cells, panelId) {
    const labels = [];
    let lastCol = -10;
    for (const cell of cells) {
      if (!cell.date.endsWith("-01")) continue;
      if (panelId !== "last" && cell.date.slice(0, 4) !== panelId) continue;
      if (cell.col - lastCol < 3) continue;
      labels.push({ col: cell.col, text: `${Number(cell.date.slice(5, 7))}月` });
      lastCol = cell.col;
    }
    return labels;
  }

  function panel(id, gridStart, gridEnd, summary) {
    const { cells, weekCount } = buildCells(gridStart, gridEnd);
    const recorded = cells.filter((cell) => {
      if (!cell.hasFile || cell.date > today) return false;
      return id === "last" || cell.date.startsWith(`${id}-`);
    }).length;
    return {
      id,
      weekCount,
      recorded,
      summary,
      months: monthLabels(cells, id),
      cells,
      weekdayLabels: profile.weekStart === "monday"
        ? [["一", 1], ["三", 3], ["五", 5]]
        : [["一", 2], ["三", 4], ["五", 6]],
    };
  }

  const thisWeek = weekStartOf(today, profile.weekStart);
  const panels = [
    panel("last", addDays(thisWeek, -52 * 7), addDays(thisWeek, 6), {
      before: "过去一年里记录了 ",
      after: " 天",
    }),
  ];
  const endYear = Number(today.slice(0, 4));
  const startYear = earliest ? Number(earliest.slice(0, 4)) : endYear;
  for (let year = endYear; year >= startYear; year -= 1) {
    const gridStart = weekStartOf(`${year}-01-01`, profile.weekStart);
    const gridEnd = addDays(weekStartOf(`${year}-12-31`, profile.weekStart), 6);
    panels.push(panel(String(year), gridStart, gridEnd, {
      before: `${year} 年记录了 `,
      after: " 天",
    }));
  }

  const habitViews = habits.map((habit) => {
    const recent = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset);
      const state = entryState(habit, date);
      recent.push({
        date,
        level: state === "done" ? 4 : 0,
        tip: `${formatChineseDate(date)}\n${habit.icon} ${habit.name}：${STATE_LABEL[state]}`,
      });
    }
    const rate = completionRate(habit);
    return {
      ...habit,
      sinceLabel: formatChineseDate(habit.since),
      currentStreak: currentStreak(habit),
      longestStreak: longestStreak(habit),
      rateLabel: rate === null ? "—" : `${Math.round(rate * 100)}%`,
      recent,
    };
  });

  const activity = logs
    .filter((log) => log.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)
    .map((log) => ({
      date: log.date,
      dateLabel: formatChineseDate(log.date),
      items: habits
        .filter((habit) => habitsOnDay(log.date).includes(habit))
        .map((habit) => {
          const entry = log.entries[habit.id];
          const state = !entry ? "absent" : entry.done ? "done" : "miss";
          return {
            icon: habit.icon,
            name: habit.name,
            state,
            label: STATE_LABEL[state],
            note: entry?.note ?? "",
          };
        }),
    }));

  return {
    profile,
    today,
    todayLabel: formatChineseDate(today),
    earliestLabel: earliest ? formatChineseDate(earliest) : "",
    overview: {
      activeCount: active.length,
      todayDone,
      todayExpected: expectedToday.length,
      todayLogged: Boolean(todayLog),
      todayValue: expectedToday.length === 0 ? "—" : todayLog ? `${todayDone}/${expectedToday.length}` : "未记录",
      currentPerfect,
      longestPerfect,
    },
    habits: habitViews,
    activity,
    panels,
  };
}
