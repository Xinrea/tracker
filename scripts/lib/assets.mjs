import fs from "node:fs";
import path from "node:path";
import { renderFaviconSvg, renderIconPng, renderOgPng } from "./icon.mjs";
import { renderManifest, renderRobots, renderSitemap, SITE_ASSETS } from "./meta.mjs";

export function writeDistAssets(dist, { profile, basePath }) {
  const files = new Map([
    [SITE_ASSETS.svg, renderFaviconSvg()],
    [SITE_ASSETS.png32, renderIconPng(32)],
    [SITE_ASSETS.apple, renderIconPng(180, { fullBleed: true })],
    [SITE_ASSETS.png192, renderIconPng(192, { fullBleed: true })],
    [SITE_ASSETS.png512, renderIconPng(512, { fullBleed: true })],
    [SITE_ASSETS.og, renderOgPng()],
    [SITE_ASSETS.manifest, renderManifest(profile, basePath)],
    [SITE_ASSETS.robots, renderRobots()],
    [SITE_ASSETS.sitemap, renderSitemap()],
  ]);
  for (const [name, contents] of files) {
    fs.writeFileSync(path.join(dist, name), contents);
  }
  return [...files.keys()];
}
