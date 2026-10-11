export const CANONICAL_URL = "https://xinrea.github.io/tracker/";
export const THEME_COLOR = "#0d1117";
export const THEME_COLOR_LIGHT = "#ffffff";

export const SITE_ASSETS = {
  svg: "favicon.svg",
  png32: "favicon-32.png",
  apple: "apple-touch-icon.png",
  png192: "icon-192.png",
  png512: "icon-512.png",
  og: "og.png",
  manifest: "site.webmanifest",
  robots: "robots.txt",
  sitemap: "sitemap.xml",
};

export function pageTitle(profile) {
  return `${profileName(profile)} 的习惯打卡`;
}

export function pageDescription(profile) {
  const name = profileName(profile);
  const bio = String(profile.bio ?? "").trim();
  return bio ? `${name} 的每日习惯打卡。${bio}` : `${name} 的每日习惯打卡`;
}

export function renderHead(profile, basePath) {
  const base = normalizeBasePath(basePath);
  const title = pageTitle(profile);
  const description = pageDescription(profile);
  const image = `${CANONICAL_URL}${SITE_ASSETS.og}`;
  const imageAlt = "深色背景上的绿色对勾，下面是一排由浅到深的习惯格子";
  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${CANONICAL_URL}">
  <meta name="theme-color" content="${THEME_COLOR}">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR_LIGHT}">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR}">
  <link rel="icon" href="${esc(asset(base, SITE_ASSETS.svg))}" type="image/svg+xml">
  <link rel="icon" href="${esc(asset(base, SITE_ASSETS.png32))}" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="${esc(asset(base, SITE_ASSETS.apple))}" sizes="180x180">
  <link rel="manifest" href="${esc(asset(base, SITE_ASSETS.manifest))}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${CANONICAL_URL}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(imageAlt)}">
  <meta property="og:locale" content="zh_CN">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${esc(imageAlt)}">`;
}

export function renderManifest(profile, basePath) {
  const base = normalizeBasePath(basePath);
  const manifest = {
    name: pageTitle(profile),
    short_name: "习惯打卡",
    description: pageDescription(profile),
    lang: "zh-CN",
    dir: "ltr",
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: asset(base, SITE_ASSETS.svg), sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: asset(base, SITE_ASSETS.png32), sizes: "32x32", type: "image/png", purpose: "any" },
      { src: asset(base, SITE_ASSETS.apple), sizes: "180x180", type: "image/png", purpose: "any" },
      { src: asset(base, SITE_ASSETS.png192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset(base, SITE_ASSETS.png512), sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${CANONICAL_URL}sitemap.xml
`;
}

export function renderSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${CANONICAL_URL}</loc>
  </url>
</urlset>
`;
}

export function normalizeBasePath(input) {
  let base = input ?? "/tracker/";
  base = base.trim();
  if (base === "") return "/";
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

function profileName(profile) {
  const name = String(profile?.name ?? "").trim();
  return name || "习惯";
}

function asset(base, name) {
  return `${base}${name}`;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
