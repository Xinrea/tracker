# 给 Agent 的修改说明

这个仓库用 TOML 记录每日打卡。页面由 GitHub Actions 解析这些文件后生成，再部署到 GitHub Pages。

记一笔打卡时，只改 `logs/` 里当天的文件。不要修改 `dist/`（构建产物，不入库），也不要为了打卡去改 `scripts/`。

改完数据后运行 `npm test`。校验失败会用中文说明原因，修到通过再提交。

## 记今天的打卡

1. 打开 `data/profile.toml`，用其中的 `timezone` 确定「今天」。不要用运行环境的本地时区代替它。日期格式是 `YYYY-MM-DD`。
2. 如果 `logs/YYYY-MM-DD.toml` 已经存在，只改这个文件里对应习惯的 `done` 和 `note`。
3. 如果不存在，把 `logs/_template.toml` 复制为 `logs/YYYY-MM-DD.toml`。
4. 把新文件里的 `date` 改成和文件名相同的日期。
5. 每个习惯只改两处：
   - `done`：完成写 `true`，没完成写 `false`
   - `note`：可选，一句说明；没有就留空字符串或删掉这一行
6. 不要增删习惯表，不要改 `id`。模板里的习惯必须和 `data/habits.toml` 中 `archived = false` 的习惯一一对应。
7. 提交并推送到 `main`。提交说明写清楚日期，例如：`记录 2026-09-22 的打卡`。

一天只有一个文件。没有这天的文件表示未记录，热力图是空格，并会打断连续天数。文件在、但 `done = false`，表示明确没完成，同样打断连续天数。今天还没写文件时，不会因此把已经形成的连续天数清零。

## 新增一个每日目标

在 `data/habits.toml` 末尾追加一块，`since` 用开始计入的那一天：

```toml
[[habit]]
id = "water"
name = "喝水"
description = "喝够 8 杯水"
icon = "💧"
since = 2026-09-22
archived = false
```

然后在 `logs/_template.toml` 加上同名的表：

```toml
[water]
done = false
note = ""
```

`id` 规则：

- 小写字母开头，后面只含小写字母、数字、下划线
- 不能叫 `date`
- 一旦有日志用过这个 `id`，就不要再改名

不要回头补写开始日期之前的日志。

## 停用一个目标

1. 把该习惯的 `archived` 改成 `true`。不要删掉这块，否则历史对不上。
2. 从 `logs/_template.toml` 删除同名的表。
3. 不要修改已经提交的历史日志。

停用后，新的一天不必再写它。它自己的连续天数停在最后一条记录，不再要求今天补记。

## 可以改的字段

`data/profile.toml`

| 字段 | 说明 |
| --- | --- |
| `name` | 页面上的名字 |
| `bio` | 一句简介 |
| `avatar` | 可选，头像的 https 地址 |
| `timezone` | IANA 时区，用来判断今天 |
| `week_start` | `sunday` 或 `monday` |

`data/habits.toml` 里每个 `[[habit]]`

| 字段 | 说明 |
| --- | --- |
| `id` | 日志里使用的稳定键 |
| `name` | 显示名称 |
| `description` | 怎样算完成 |
| `icon` | 一个 emoji |
| `since` | 开始日期，TOML 日期，不要加引号 |
| `archived` | `true` 或 `false` |

`logs/YYYY-MM-DD.toml`

| 字段 | 说明 |
| --- | --- |
| `date` | 与文件名相同的日期 |
| `done` | 必须是布尔值 |
| `note` | 可选字符串，最多 200 字 |

不要增加上面没有的字段。构建会直接报错。

## 校验会拒绝的情况

- 文件名不是 `YYYY-MM-DD.toml`，或和里面的 `date` 不一致
- 日期晚于 `timezone` 里的今天
- 习惯写在自己的 `since` 之前
- `done` 缺失，或不是布尔值
- 引用了不存在的习惯
- `logs/_template.toml` 和当前未停用的习惯不一致
- 未知字段、重复的 `id`

## 提交

推送到 `main` 后，Actions 会执行 `npm ci`、`npm test`、`npm run build`，并把 `dist/` 部署到 GitHub Pages。页面地址是 `https://xinrea.github.io/tracker/`。
