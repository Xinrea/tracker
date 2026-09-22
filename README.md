# tracker

GitHub 个人主页风格的每日习惯打卡页。打卡内容写在 TOML 里，推送到 `main` 之后自动构建，并由 GitHub Pages 发布。

页面：<https://xinrea.github.io/tracker/>

想让助手改数据时，把 [AGENTS.md](AGENTS.md) 交给它。那里有记一天、加目标、停用目标的步骤。

## 数据放在哪

- [`data/profile.toml`](data/profile.toml)：名字、简介、头像、时区、热力图从周几开始、浏览者可以点的表情
- [`data/habits.toml`](data/habits.toml)：每日目标
- [`logs/YYYY-MM-DD.toml`](logs/_template.toml)：某一天的打卡。复制 [`logs/_template.toml`](logs/_template.toml) 再改 `date`、`done` 和 `note`

```toml
date = 2026-09-22

[cook]
done = true
note = "自己做了晚饭"

[pullup]
done = false
note = ""
```

没有这天的文件就是未记录。`done = false` 是明确没完成。两种都会打断连续天数；如果今天还没写，已经累计的连续天数会先保留。

## 本地预览

```bash
npm install
npm test
BASE_PATH=/ npm run build
npx serve dist
```

发布到 GitHub Pages 时不用设置 `BASE_PATH`，默认是 `/tracker/`。`dist/` 是构建结果，不要提交。

## 自动部署

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 在 `main` 有新提交时运行测试、生成页面并部署。

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。

## 表情计数

左侧的表情按钮请求 `https://xinrea.cn/tracker/reactions`。接口在 [`worker/`](worker/) 里，数据在 Cloudflare D1。第一次部署：

```bash
cd worker
npx wrangler login
npx wrangler d1 create tracker-reactions
npx wrangler d1 migrations apply tracker-reactions --remote
npx wrangler secret put IP_SALT
npm run deploy
```

`d1 create` 会给出 `database_id`，写进 `worker/wrangler.jsonc`。`IP_SALT` 是任意长随机字符串，用来给访问地址做哈希，不写进仓库。
