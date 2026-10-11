import { deflateSync, crc32 } from "node:zlib";

const VB = 64;

export const THEME = {
  bg: "#0d1117",
  border: "#30363d",
  level: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  check: "#39d353",
};

const RGB = {
  bg: hex("#0d1117"),
  border: hex("#30363d"),
  level: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"].map(hex),
  check: hex("#39d353"),
};

const CHECK = [[18, 28], [28, 39], [47, 18]];
const CHECK_STROKE = 6.5;
const CELLS = [
  { x: 8, y: 48, level: 0 },
  { x: 18, y: 48, level: 1 },
  { x: 28, y: 48, level: 2 },
  { x: 38, y: 48, level: 3 },
  { x: 48, y: 48, level: 4 },
];

export function renderFaviconSvg() {
  const cells = CELLS.map((cell) => {
    const fill = THEME.level[cell.level];
    return `  <rect x="${cell.x}" y="${cell.y}" width="8" height="8" rx="2" fill="${fill}"/>`;
  }).join("\n");
  const [a, b, c] = CHECK;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" role="img">
  <title>习惯打卡</title>
  <rect width="${VB}" height="${VB}" rx="14" fill="${THEME.bg}"/>
  <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="${THEME.border}" stroke-width="2"/>
  <path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}" fill="none" stroke="${THEME.check}" stroke-width="${CHECK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
${cells}
</svg>
`;
}

export function renderIconPng(size, options = {}) {
  return encodePng(renderIconCanvas(size, options));
}

export function renderIconCanvas(size, options = {}) {
  const fullBleed = options.fullBleed === true;
  const canvas = createCanvas(size, size);
  paintIcon(canvas, { x: 0, y: 0, size, fullBleed, framed: !fullBleed });
  return canvas;
}

export function renderOgPng() {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height, RGB.bg);
  paintHeatmap(canvas);
  paintIcon(canvas, { x: 78, y: 115, size: 400, fullBleed: false, framed: true });
  return encodePng(canvas);
}

export function pngSize(buffer) {
  const png = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (png.length < 24 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("不是 PNG");
  }
  if (png.subarray(12, 16).toString("ascii") !== "IHDR") throw new Error("PNG 缺少 IHDR");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function paintIcon(canvas, { x, y, size, fullBleed, framed }) {
  const s = size / VB;
  const X = (value) => x + value * s;
  const Y = (value) => y + value * s;
  const S = (value) => value * s;
  if (fullBleed) {
    fillRect(canvas, 0, 0, canvas.width, canvas.height, RGB.bg);
  }
  if (framed) {
    fillRoundRect(canvas, X(0), Y(0), S(VB), S(VB), S(14), RGB.bg);
    strokeRoundRect(canvas, X(1), Y(1), S(62), S(62), S(13), Math.max(1, S(2)), RGB.border);
  }
  for (const cell of CELLS) {
    fillRoundRect(canvas, X(cell.x), Y(cell.y), S(8), S(8), S(2), RGB.level[cell.level]);
  }
  strokePolyline(canvas, CHECK.map(([px, py]) => [X(px), Y(py)]), S(CHECK_STROKE), RGB.check);
}

function paintHeatmap(canvas) {
  const cell = 18;
  const gap = 5;
  const cols = 26;
  const rows = 7;
  const radius = 4;
  const gridWidth = cols * cell + (cols - 1) * gap;
  const gridHeight = rows * cell + (rows - 1) * gap;
  const originX = canvas.width - 72 - gridWidth;
  const originY = Math.round((canvas.height - gridHeight) / 2);
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      fillRoundRect(
        canvas,
        originX + col * (cell + gap),
        originY + row * (cell + gap),
        cell,
        cell,
        radius,
        RGB.level[heatLevel(col, row, cols)],
      );
    }
  }
}

function heatLevel(col, row, cols) {
  const fromEnd = cols - 1 - col;
  if (fromEnd < 5) return row === 1 ? 3 : 4;
  const n = (col * 13 + row * 7 + ((col * 3) ^ (row * 5))) % 17;
  if (n < 4) return 0;
  if (n < 8) return 1;
  if (n < 12) return 2;
  if (n < 15) return 3;
  return 4;
}

function createCanvas(width, height, fill) {
  const data = Buffer.alloc(width * height * 4, fill ? undefined : 0);
  const canvas = { width, height, data };
  if (fill) fillRect(canvas, 0, 0, width, height, fill);
  return canvas;
}

function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + w));
  const y1 = Math.min(canvas.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      blend(canvas, px, py, color, 1);
    }
  }
}

function fillRoundRect(canvas, x, y, w, h, radius, color) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  forEachPixel(canvas, x, y, w, h, 1, (px, py) => {
    const sd = sdRoundRect(px, py, x, y, w, h, r);
    return cover(sd);
  }, color);
}

function strokeRoundRect(canvas, x, y, w, h, radius, stroke, color) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const half = stroke / 2;
  forEachPixel(canvas, x - half, y - half, w + stroke, h + stroke, half + 1, (px, py) => {
    const sd = sdRoundRect(px, py, x, y, w, h, r);
    return cover(Math.abs(sd) - half);
  }, color);
}

function strokePolyline(canvas, points, stroke, color) {
  const half = stroke / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  forEachPixel(canvas, minX - half, minY - half, maxX - minX + stroke, maxY - minY + stroke, half + 1, (px, py) => {
    let dist = Infinity;
    for (let i = 0; i < points.length - 1; i += 1) {
      dist = Math.min(dist, distToSegment(px, py, points[i], points[i + 1]));
    }
    return cover(dist - half);
  }, color);
}

function forEachPixel(canvas, x, y, w, h, pad, coverageAt, color) {
  const x0 = Math.max(0, Math.floor(x - pad));
  const y0 = Math.max(0, Math.floor(y - pad));
  const x1 = Math.min(canvas.width, Math.ceil(x + w + pad));
  const y1 = Math.min(canvas.height, Math.ceil(y + h + pad));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const coverage = coverageAt(px + 0.5, py + 0.5);
      if (coverage > 0) blend(canvas, px, py, color, coverage);
    }
  }
}

function cover(signedDistance) {
  return clamp(0.5 - signedDistance, 0, 1);
}

function sdRoundRect(px, py, x, y, w, h, radius) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.abs(px - cx) - (w / 2 - radius);
  const dy = Math.abs(py - cy) - (h / 2 - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - radius;
}

function distToSegment(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - a[0]) * dx + (py - a[1]) * dy) / len2, 0, 1);
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function blend(canvas, x, y, color, coverage) {
  if (coverage <= 0) return;
  const index = (y * canvas.width + x) * 4;
  const data = canvas.data;
  const srcA = (color[3] / 255) * coverage;
  if (srcA >= 0.999) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = 255;
    return;
  }
  const dstA = data[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  data[index] = Math.round((color[0] * srcA + data[index] * dstA * (1 - srcA)) / outA);
  data[index + 1] = Math.round((color[1] * srcA + data[index + 1] * dstA * (1 - srcA)) / outA);
  data[index + 2] = Math.round((color[2] * srcA + data[index + 2] * dstA * (1 - srcA)) / outA);
  data[index + 3] = Math.round(outA * 255);
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (stride + 1);
    raw[offset] = 0;
    data.copy(raw, offset + 1, y * stride, y * stride + stride);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, checksum]);
}

function hex(value) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    255,
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
