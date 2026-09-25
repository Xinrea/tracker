const AVATAR_COLORS = ["#0969da", "#8250df", "#bf3989", "#cf222e", "#1a7f37", "#9a6700"];

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

export function normalizeBasePath(input) {
  let base = input ?? "/tracker/";
  base = base.trim();
  if (base === "") return "/";
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

function reactionsMarkup(profile) {
  if (!profile.reactions?.length || !profile.reactionsApi) return "";
  const buttons = profile.reactions.map((emoji) => {
    const safe = escapeHtml(emoji);
    return `<button type="button" class="reaction" data-emoji="${safe}" aria-pressed="false" aria-label="贴上 ${safe}"><span class="reaction-emoji" aria-hidden="true">${safe}</span><span class="reaction-count">—</span></button>`;
  }).join("");
  return `<section class="reactions" data-api="${escapeHtml(profile.reactionsApi)}" aria-label="表情"><h2>贴个表情</h2><div class="reaction-list">${buttons}</div></section>`;
}

function initial(name) {
  const char = Array.from(name)[0] ?? "?";
  return char.toLocaleUpperCase("en-US");
}

function avatarColor(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function dayButton(cell, extraClass = "") {
  const cls = extraClass ? `day ${extraClass}` : "day";
  return `<button type="button" class="${cls}" data-level="${cell.level}" data-today="${cell.today ? "true" : "false"}" data-tip="${escapeAttr(cell.tip)}" aria-label="${escapeAttr(cell.tip)}" style="grid-column:${cell.col + 1};grid-row:${cell.row + 1}"></button>`;
}

function panelMarkup(panel) {
  const months = panel.months
    .map((month) => `<span class="month" style="grid-column:${month.col + 1}">${escapeHtml(month.text)}</span>`)
    .join("");
  const weekdays = panel.weekdayLabels
    .map(([label, row]) => `<span class="wday" style="grid-row:${row + 1}">${label}</span>`)
    .join("");
  const days = panel.cells.map((cell) => dayButton(cell)).join("");
  return `<div class="cal-scroll" data-year-panel="${escapeHtml(panel.id)}">
    <div class="graph" style="--weeks:${panel.weekCount}">
      ${months}
      ${weekdays}
      ${days}
    </div>
  </div>`;
}

function habitCard(habit) {
  const recent = habit.recent
    .map((cell) => `<button type="button" class="day mini" data-level="${cell.level}" data-tip="${escapeAttr(cell.tip)}" aria-label="${escapeAttr(cell.tip)}"></button>`)
    .join("");
  const badge = habit.archived ? `<span class="badge">已停用</span>` : "";
  return `<article class="habit${habit.archived ? " archived" : ""}">
    <header>
      <span class="habit-icon" aria-hidden="true">${escapeHtml(habit.icon)}</span>
      <div>
        <h3>${escapeHtml(habit.name)}</h3>
        <p>${escapeHtml(habit.description)}</p>
      </div>
      ${badge}
    </header>
    <dl>
      <div><dt>当前连续</dt><dd>${habit.currentStreak}<small> 天</small></dd></div>
      <div><dt>最长连续</dt><dd>${habit.longestStreak}<small> 天</small></dd></div>
      <div><dt>近 30 天</dt><dd>${escapeHtml(habit.rateLabel)}</dd></div>
    </dl>
    <p class="since">自 ${escapeHtml(habit.sinceLabel)}</p>
    <div class="recent">${recent}</div>
  </article>`;
}

function activityItems(day) {
  return day.items
    .map((item) => `<li class="event ${item.state}">
          <span class="event-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
          <span class="event-name">${escapeHtml(item.name)}</span>
          <span class="event-state">${escapeHtml(item.label)}</span>
          ${item.note ? `<span class="event-note">${escapeHtml(item.note)}</span>` : ""}
        </li>`)
    .join("");
}

function activityMarkup(activity) {
  if (activity.length === 0) {
    return `<p class="empty">还没有打卡记录。把 <code>logs/_template.toml</code> 复制成今天的日期文件，填好后推送到 main。</p>`;
  }
  const tabs = activity
    .map((day, index) => {
      const selected = index === 0;
      const date = escapeHtml(day.date);
      return `<button type="button" class="activity-tab" role="tab" id="activity-tab-${date}" data-activity-tab="${date}" aria-controls="activity-panel-${date}" aria-selected="${selected ? "true" : "false"}" tabindex="${selected ? "0" : "-1"}">${escapeHtml(day.dateLabel)}</button>`;
    })
    .join("");
  const panels = activity
    .map((day, index) => {
      const date = escapeHtml(day.date);
      const hidden = index === 0 ? "" : " hidden";
      return `<div class="activity-panel" role="tabpanel" id="activity-panel-${date}" data-activity-panel="${date}" aria-labelledby="activity-tab-${date}"${hidden}><h3>${escapeHtml(day.dateLabel)}</h3><ul>${activityItems(day)}</ul></div>`;
    })
    .join("");
  return `<div class="activity-tabs" role="tablist" aria-label="最近记录">${tabs}</div>${panels}`;
}

const STYLES = `
:root {
  color-scheme: light;
  --bg: #ffffff;
  --border: #d0d7de;
  --text: #1f2328;
  --muted: #656d76;
  --accent: #0969da;
  --done: #1a7f37;
  --miss: #cf222e;
  --level-0: #ebedf0;
  --level-1: #9be9a8;
  --level-2: #40c463;
  --level-3: #30a14e;
  --level-4: #216e39;
  --cell-line: rgba(27, 31, 35, 0.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #0d1117;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --accent: #4493f8;
    --done: #3fb950;
    --miss: #f85149;
    --level-0: #161b22;
    --level-1: #0e4429;
    --level-2: #006d32;
    --level-3: #26a641;
    --level-4: #39d353;
    --cell-line: rgba(255, 255, 255, 0.05);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, p, ul, dl { margin: 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
.wrap {
  max-width: 1216px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  display: grid;
  grid-template-columns: 296px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.profile { position: sticky; top: 24px; }
.avatar {
  width: min(100%, 260px);
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border);
}
img.avatar { display: block; object-fit: cover; }
div.avatar {
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 72px;
  font-weight: 600;
}
.profile h1 { margin-top: 16px; font-size: 24px; line-height: 1.25; font-weight: 600; }
.bio { margin-top: 8px; font-size: 16px; }
.meta { list-style: none; padding: 0; margin-top: 16px; display: grid; gap: 8px; color: var(--muted); }
.meta li { display: flex; align-items: center; gap: 8px; }
.meta svg { flex: none; }
.main { display: grid; gap: 16px; min-width: 0; }
.main > * { min-width: 0; max-width: 100%; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.stat, .card, .habit, .activity {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}
.stat { padding: 12px 16px; }
.stat span, .habit dt, .since, .legend, .month, .wday { color: var(--muted); }
.stat b, .habit dd { display: block; margin-top: 4px; font-size: 20px; font-weight: 600; line-height: 1.2; }
.stat small, .habit small { font-size: 14px; font-weight: 400; color: var(--muted); }
.card { padding: 16px; }
.graph-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.graph-head h2 { font-size: 16px; font-weight: 400; }
.graph-head h2[hidden], .cal-scroll[hidden], .activity-panel[hidden] { display: none; }
.graph-head strong { font-weight: 600; }
select {
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 8px;
}
.cal-scroll { overflow-x: auto; max-width: 100%; padding-bottom: 4px; }
.graph {
  display: grid;
  grid-template-columns: 28px repeat(var(--weeks), 11px);
  grid-template-rows: 18px repeat(7, 11px);
  column-gap: 3px;
  row-gap: 3px;
  width: max-content;
}
.month { grid-row: 1; font-size: 12px; line-height: 18px; white-space: nowrap; }
.wday { grid-column: 1; font-size: 12px; line-height: 11px; }
button.day {
  width: 11px;
  height: 11px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  appearance: none;
  background: var(--level-0);
  box-shadow: inset 0 0 0 1px var(--cell-line);
  cursor: pointer;
}
button.day[data-level="1"] { background: var(--level-1); }
button.day[data-level="2"] { background: var(--level-2); }
button.day[data-level="3"] { background: var(--level-3); }
button.day[data-level="4"] { background: var(--level-4); }
button.day[data-today="true"], button.day:hover, button.day:focus-visible {
  outline: 1px solid var(--muted);
  outline-offset: 1px;
}
.legend { display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-top: 12px; font-size: 12px; }
.swatch {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: var(--level-0);
  box-shadow: inset 0 0 0 1px var(--cell-line);
}
.swatch[data-level="1"] { background: var(--level-1); }
.swatch[data-level="2"] { background: var(--level-2); }
.swatch[data-level="3"] { background: var(--level-3); }
.swatch[data-level="4"] { background: var(--level-4); }
.section-title { font-size: 16px; font-weight: 600; }
.habits { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.habit { padding: 16px; }
.habit header { display: flex; gap: 10px; align-items: flex-start; }
.habit-icon { font-size: 22px; line-height: 1.2; }
.habit h3 { font-size: 16px; }
.habit header p { color: var(--muted); font-size: 12px; }
.badge {
  margin-left: auto;
  flex: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 20px;
}
.habit dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.habit dt { font-size: 12px; }
.habit dd { font-size: 16px; }
.since { margin-top: 10px; font-size: 12px; }
.recent { display: flex; gap: 3px; margin-top: 8px; }
button.day.mini { width: 12px; height: 12px; }
.activity { padding: 0; }
.activity > .empty { margin: 8px 16px 16px; }
.activity-tabs {
  display: flex;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-bottom: 1px solid var(--border);
  scrollbar-width: thin;
}
button.activity-tab {
  flex: 0 0 auto;
  margin: 0;
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  font: inherit;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
}
button.activity-tab:hover { color: var(--text); }
button.activity-tab[aria-selected="true"] {
  color: var(--text);
  font-weight: 600;
  border-bottom-color: var(--accent);
}
button.activity-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.activity-panel { padding: 12px 16px 16px; }
.activity-panel h3 { font-size: 14px; font-weight: 600; }
.activity-panel ul { list-style: none; padding: 0; }
.event {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}
.event-name { font-weight: 600; }
.event-state.done, .event.done .event-state { color: var(--done); }
.event.miss .event-state, .event.absent .event-state { color: var(--miss); }
.event-note { color: var(--muted); }
.empty { color: var(--muted); padding: 8px 0; }
.footer { color: var(--muted); font-size: 12px; }
.reactions { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
.reactions h2 { margin-bottom: 8px; color: var(--muted); font-size: 12px; font-weight: 600; }
.reaction-list { display: flex; flex-wrap: wrap; gap: 8px; }
button.reaction {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
button.reaction[aria-pressed="true"] {
  border-color: var(--level-3);
  background: color-mix(in srgb, var(--level-2) 28%, transparent);
}
button.reaction:disabled { cursor: progress; opacity: 0.6; }
.reaction-count { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
button.reaction[aria-pressed="true"] .reaction-count { color: var(--done); }
#tooltip {
  position: fixed;
  z-index: 20;
  max-width: 280px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #24292f;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-line;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
}
#tooltip[hidden] { display: none; }
@media (max-width: 900px) {
  .wrap { grid-template-columns: 1fr; padding: 16px 16px 48px; }
  .profile { position: static; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
  .avatar { width: 96px; font-size: 36px; flex: none; }
  .profile-body { flex: 1; min-width: 0; }
  .reactions { flex: 1 0 100%; margin-top: 4px; }
  .profile h1 { margin-top: 0; font-size: 20px; }
  .bio { font-size: 14px; }
  .stats { grid-template-columns: 1fr 1fr; }
}
`;

const SCRIPT = `
const select = document.querySelector("#year-select");
const panels = document.querySelectorAll("[data-year-panel]");
const tip = document.querySelector("#tooltip");
let current = null;

function hideTip() {
  current = null;
  tip.hidden = true;
}

function showTip(day) {
  const text = day.getAttribute("data-tip");
  if (!text) return;
  tip.hidden = false;
  tip.textContent = text;
  const rect = day.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  let top = rect.top - tipRect.height - 8;
  if (top < 8) top = rect.bottom + 8;
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}

select.addEventListener("change", () => {
  panels.forEach((panel) => {
    panel.hidden = panel.getAttribute("data-year-panel") !== select.value;
  });
  hideTip();
});

document.addEventListener("mouseover", (event) => {
  const day = event.target.closest("button.day");
  if (!day || day.closest("[hidden]")) {
    if (current) hideTip();
    return;
  }
  if (day === current) return;
  current = day;
  showTip(day);
});

document.addEventListener("focusin", (event) => {
  const day = event.target.closest("button.day");
  if (!day || day.closest("[hidden]")) return;
  current = day;
  showTip(day);
});

document.addEventListener("focusout", (event) => {
  if (event.target.closest("button.day")) hideTip();
});

window.addEventListener("scroll", hideTip, true);

const activityTabs = document.querySelector(".activity-tabs");
if (activityTabs) {
  const activityRoot = activityTabs.parentElement;
  function showActivity(date) {
    activityRoot.querySelectorAll("[data-activity-tab]").forEach((tab) => {
      const on = tab.getAttribute("data-activity-tab") === date;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    activityRoot.querySelectorAll("[data-activity-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-activity-panel") !== date;
    });
  }
  activityTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-activity-tab]");
    if (!tab) return;
    showActivity(tab.getAttribute("data-activity-tab"));
  });
  activityTabs.addEventListener("keydown", (event) => {
    const tabs = Array.from(activityTabs.querySelectorAll("[data-activity-tab]"));
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next];
    showActivity(tab.getAttribute("data-activity-tab"));
    tab.focus();
    tab.scrollIntoView({ inline: "nearest", block: "nearest" });
  });
}

const reactionRoot = document.querySelector(".reactions");
if (reactionRoot) {
  const reactionApi = reactionRoot.getAttribute("data-api");
  const visitorKey = "tracker-reaction-visitor";
  const selectedKey = "tracker-reactions";
  let visitorId = "";
  let selected = new Set();
  try {
    visitorId = localStorage.getItem(visitorKey) || "";
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(visitorKey, visitorId);
    }
    const saved = JSON.parse(localStorage.getItem(selectedKey) || "[]");
    if (Array.isArray(saved)) selected = new Set(saved);
  } catch (error) {
    visitorId = visitorId || crypto.randomUUID();
  }
  let reactionCounts = null;

  function paintReactions() {
    reactionRoot.querySelectorAll(".reaction").forEach((button) => {
      const emoji = button.getAttribute("data-emoji");
      const value = reactionCounts && Object.prototype.hasOwnProperty.call(reactionCounts, emoji)
        ? reactionCounts[emoji]
        : null;
      button.querySelector(".reaction-count").textContent = value === null ? "—" : String(value);
      button.setAttribute("aria-pressed", selected.has(emoji) ? "true" : "false");
    });
  }

  function rememberSelected() {
    try {
      localStorage.setItem(selectedKey, JSON.stringify(Array.from(selected)));
    } catch (error) {
      /* 隐私模式写不进本地存储时，这一次点击仍然发给服务器。 */
    }
  }

  reactionRoot.addEventListener("click", (event) => {
    const button = event.target.closest(".reaction");
    if (!button || button.disabled) return;
    const emoji = button.getAttribute("data-emoji");
    const action = selected.has(emoji) ? "remove" : "add";
    button.disabled = true;
    fetch(reactionApi, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ emoji: emoji, action: action, visitor: visitorId }),
    }).then((response) => {
      if (!response.ok) throw new Error("reaction failed");
      return response.json();
    }).then((data) => {
      if (action === "add") selected.add(emoji);
      else selected.delete(emoji);
      rememberSelected();
      reactionCounts = data.counts || null;
      paintReactions();
    }).catch(() => {
      paintReactions();
    }).finally(() => {
      button.disabled = false;
    });
  });

  fetch(reactionApi, { headers: { accept: "application/json" } }).then((response) => {
    if (!response.ok) throw new Error("reaction failed");
    return response.json();
  }).then((data) => {
    reactionCounts = data.counts || null;
    paintReactions();
  }).catch(() => {
    paintReactions();
  });
}
`;

export function renderPage(view, options = {}) {
  const basePath = normalizeBasePath(options.basePath);
  const { profile, overview, habits, activity, panels } = view;
  const color = avatarColor(profile.name);
  const avatar = profile.avatar
    ? `<img class="avatar" src="${escapeHtml(profile.avatar)}" alt="">`
    : `<div class="avatar" style="background:${color}" aria-hidden="true">${escapeHtml(initial(profile.name))}</div>`;
  const titles = panels
    .map((panel, index) => {
      const hidden = index === 0 ? "" : " hidden";
      return `<h2 data-year-panel="${escapeHtml(panel.id)}"${hidden}>${escapeHtml(panel.summary.before)}<strong>${panel.recorded}</strong>${escapeHtml(panel.summary.after)}</h2>`;
    })
    .join("");
  const optionsHtml = panels
    .map((panel, index) => {
      const label = panel.id === "last" ? "过去一年" : panel.id;
      const selected = index === 0 ? " selected" : "";
      return `<option value="${escapeHtml(panel.id)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
  const calendars = panels
    .map((panel, index) => {
      const markup = panelMarkup(panel);
      return index === 0 ? markup : markup.replace("<div ", "<div hidden ");
    })
    .join("");
  const started = view.earliestLabel
    ? `从 ${escapeHtml(view.earliestLabel)} 开始`
    : "还没有开始";
  const habitsHtml = habits.length === 0
    ? `<p class="empty">还没有每日目标。在 data/habits.toml 里用 [[habit]] 加一个。</p>`
    : habits.map(habitCard).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${escapeHtml(basePath)}">
  <title>${escapeHtml(profile.name)} 的习惯打卡</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="wrap">
    <aside class="profile">
      ${avatar}
      <div class="profile-body">
        <h1>${escapeHtml(profile.name)}</h1>
        <p class="bio">${escapeHtml(profile.bio)}</p>
        <ul class="meta">
          <li>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.25"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>
            时区 ${escapeHtml(profile.timezone)}
          </li>
          <li>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.25"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>
            ${started}
          </li>
          <li>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 8.5h4" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M6.5 6H5.2a2.2 2.2 0 0 0 0 4.4H6.5M9.5 6h1.3a2.2 2.2 0 0 1 0 4.4H9.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>
            <a href="https://github.com/Xinrea/tracker">Xinrea/tracker</a>
          </li>
        </ul>
      </div>
      ${reactionsMarkup(profile)}
    </aside>
    <main class="main">
      <section class="stats" aria-label="总览">
        <div class="stat"><span>追踪中</span><b>${overview.activeCount}</b></div>
        <div class="stat"><span>今天</span><b>${escapeHtml(overview.todayValue)}</b></div>
        <div class="stat"><span>当前连续</span><b>${overview.currentPerfect}<small> 天</small></b></div>
        <div class="stat"><span>最长连续</span><b>${overview.longestPerfect}<small> 天</small></b></div>
      </section>
      <section class="card" aria-label="打卡热力图">
        <div class="graph-head">
          <div class="titles">${titles}</div>
          <select id="year-select" aria-label="选择时间范围">${optionsHtml}</select>
        </div>
        ${calendars}
        <div class="legend" aria-hidden="true"><span>少</span><i class="swatch" data-level="0"></i><i class="swatch" data-level="1"></i><i class="swatch" data-level="2"></i><i class="swatch" data-level="3"></i><i class="swatch" data-level="4"></i><span>多</span></div>
      </section>
      <h2 class="section-title">每日目标</h2>
      <div class="habits">${habitsHtml}</div>
      <h2 class="section-title">最近记录</h2>
      <section class="activity">${activityMarkup(activity)}</section>
      <p class="footer">今天是 ${escapeHtml(view.todayLabel)}。页面由仓库里的 TOML 生成，推送到 main 后自动更新。</p>
    </main>
  </div>
  <div id="tooltip" role="tooltip" hidden></div>
  <script>${SCRIPT}</script>
</body>
</html>
`;
}
