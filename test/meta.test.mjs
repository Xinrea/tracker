import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeDistAssets } from "../scripts/lib/assets.mjs";
import { pngSize, renderFaviconSvg, renderIconCanvas, renderIconPng, renderOgPng } from "../scripts/lib/icon.mjs";
import { renderManifest, renderRobots, renderSitemap } from "../scripts/lib/meta.mjs";
import { renderPage } from "../scripts/lib/render.mjs";
import { buildView } from "../scripts/lib/stats.mjs";

function view(bio = "用每天的小事，堆出一年的格子。") {
  return buildView({
    profile: {
      name: "Xinrea",
      bio,
      timezone: "Asia/Shanghai",
      weekStart: "sunday",
    },
    habits: [],
    logs: [],
    today: "2026-09-22",
  });
}

test("页面带中文语言、说明、canonical、主题色、图标和社交标签", () => {
  const html = renderPage(view(), { basePath: "/tracker" });
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>Xinrea 的习惯打卡<\/title>/);
  assert.match(html, /<meta name="description" content="Xinrea 的每日习惯打卡。用每天的小事，堆出一年的格子。">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/xinrea\.github\.io\/tracker\/">/);
  assert.match(html, /<meta name="theme-color" content="#0d1117">/);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: dark\)" content="#0d1117">/);
  assert.match(html, /<link rel="icon" href="\/tracker\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<link rel="icon" href="\/tracker\/favicon-32\.png" type="image\/png" sizes="32x32">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/tracker\/apple-touch-icon\.png" sizes="180x180">/);
  assert.match(html, /<link rel="manifest" href="\/tracker\/site\.webmanifest">/);
  assert.match(html, /<meta property="og:title" content="Xinrea 的习惯打卡">/);
  assert.match(html, /<meta property="og:description" content="Xinrea 的每日习惯打卡。用每天的小事，堆出一年的格子。">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/xinrea\.github\.io\/tracker\/">/);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/xinrea\.github\.io\/tracker\/og\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:title" content="Xinrea 的习惯打卡">/);
  assert.match(html, /<meta name="twitter:description" content="Xinrea 的每日习惯打卡。用每天的小事，堆出一年的格子。">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/xinrea\.github\.io\/tracker\/og\.png">/);
  assert.match(html, /<base href="\/tracker\/">/);
});

test("本地根路径仍指向 Pages 子路径上的绝对地址，图标走当前 base", () => {
  const html = renderPage(view('说"你好" <b>'), { basePath: "/" });
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/xinrea\.github\.io\/tracker\/">/);
  assert.match(html, /content="Xinrea 的每日习惯打卡。说&quot;你好&quot; &lt;b&gt;"/);
  assert.equal(html.includes('content="Xinrea 的每日习惯打卡。说"你好"'), false);
});

test("清单、robots 和 sitemap 使用 /tracker/ 子路径", () => {
  const manifest = JSON.parse(renderManifest({ name: "Xinrea", bio: "bio" }, "tracker"));
  assert.equal(manifest.name, "Xinrea 的习惯打卡");
  assert.equal(manifest.short_name, "习惯打卡");
  assert.equal(manifest.lang, "zh-CN");
  assert.equal(manifest.start_url, "/tracker/");
  assert.equal(manifest.scope, "/tracker/");
  assert.equal(manifest.background_color, "#0d1117");
  assert.equal(manifest.theme_color, "#0d1117");
  assert.deepEqual(manifest.icons.map((icon) => [icon.src, icon.sizes]), [
    ["/tracker/favicon.svg", "any"],
    ["/tracker/favicon-32.png", "32x32"],
    ["/tracker/apple-touch-icon.png", "180x180"],
    ["/tracker/icon-192.png", "192x192"],
    ["/tracker/icon-512.png", "512x512"],
  ]);
  assert.match(renderRobots(), /Sitemap: https:\/\/xinrea\.github\.io\/tracker\/sitemap\.xml/);
  assert.match(renderSitemap(), /<loc>https:\/\/xinrea\.github\.io\/tracker\/<\/loc>/);
});

test("图标 PNG 尺寸正确，SVG 使用深色底和绿色对勾", () => {
  assert.deepEqual(pngSize(renderIconPng(32)), { width: 32, height: 32 });
  assert.deepEqual(pngSize(renderIconPng(180, { fullBleed: true })), { width: 180, height: 180 });
  assert.deepEqual(pngSize(renderIconPng(192, { fullBleed: true })), { width: 192, height: 192 });
  assert.deepEqual(pngSize(renderIconPng(512, { fullBleed: true })), { width: 512, height: 512 });
  assert.deepEqual(pngSize(renderOgPng()), { width: 1200, height: 630 });

  const rounded = renderIconCanvas(64);
  assert.deepEqual(pixel(rounded, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixel(rounded, 8, 8), [13, 17, 23, 255]);
  assert.deepEqual(pixel(rounded, 37, 28), [57, 211, 83, 255]);
  assert.deepEqual(pixel(rounded, 12, 52), [22, 27, 34, 255]);
  assert.deepEqual(pixel(rounded, 52, 52), [57, 211, 83, 255]);

  const apple = renderIconCanvas(64, { fullBleed: true });
  assert.deepEqual(pixel(apple, 0, 0), [13, 17, 23, 255]);

  const svg = renderFaviconSvg();
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /fill="#0d1117"/);
  assert.match(svg, /stroke="#39d353"/);
  assert.match(svg, /fill="#161b22"/);
  assert.match(svg, /<path /);
});

test("构建会把图标、清单、robots 和 sitemap 写到输出目录", () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-assets-"));
  const names = writeDistAssets(dist, {
    profile: { name: "Xinrea", bio: "bio" },
    basePath: "/tracker/",
  });
  assert.deepEqual(names, [
    "favicon.svg",
    "favicon-32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "og.png",
    "site.webmanifest",
    "robots.txt",
    "sitemap.xml",
  ]);
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, "site.webmanifest"), "utf8"));
  assert.equal(manifest.icons[3].src, "/tracker/icon-192.png");
  assert.equal(pngSize(fs.readFileSync(path.join(dist, "apple-touch-icon.png"))).width, 180);
  assert.equal(pngSize(fs.readFileSync(path.join(dist, "og.png"))).height, 630);
});

function pixel(canvas, x, y) {
  const index = (y * canvas.width + x) * 4;
  return [...canvas.data.subarray(index, index + 4)];
}
