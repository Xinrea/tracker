import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { buildView } from "./lib/stats.mjs";
import { renderPage } from "./lib/render.mjs";
import { listLogFiles, TrackerError, validateData } from "./lib/validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readToml(relativePath) {
  const absolute = path.join(root, relativePath);
  let text;
  try {
    text = fs.readFileSync(absolute, "utf8");
  } catch {
    throw new Error(`错误：找不到 ${relativePath}`);
  }
  try {
    return parse(text);
  } catch (error) {
    throw new Error(`错误：无法解析 ${relativePath}：${error.message}`);
  }
}

function loadLogs() {
  const names = fs.readdirSync(path.join(root, "logs"));
  const listed = listLogFiles(names);
  if (listed.errors.length > 0) throw new TrackerError(listed.errors);
  return listed.files.map((file) => ({
    file,
    data: readToml(path.join("logs", file)),
  }));
}

try {
  const model = validateData({
    profile: readToml("data/profile.toml"),
    habits: readToml("data/habits.toml"),
    template: readToml("logs/_template.toml"),
    logs: loadLogs(),
  });
  const html = renderPage(buildView(model), {
    basePath: process.env.BASE_PATH ?? "/tracker/",
  });
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "index.html"), html);
  console.log(`已生成 dist/index.html（今天 ${model.today}，${model.logs.length} 天记录）`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
