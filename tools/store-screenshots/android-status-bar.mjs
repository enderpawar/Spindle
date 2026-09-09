/**
 * capture-web.mjs가 비워 둔 상단 상태바 자리를 Android 상태바로 채운다.
 *
 * ios-status-bar.mjs와 짝을 이룬다 — 같은 소스(public/screenshots/web/phone)를 받아
 * OS별 상태바만 다르게 그린다. Android는 시각이 왼쪽, 아이콘(신호·와이파이·배터리)이
 * 오른쪽에 오는 머티리얼 스타일 레이아웃이라 iOS(중앙 시각 + 노치 좌우 분리)와 다르게 그린다.
 *
 * 실행: npm run capture:android   (tools/store-screenshots 에서)
 * 결과: public/screenshots/android/phone/*.png — 에디터의 android 덱이 이 경로를 본다.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(TOOL_DIR, "public", "screenshots", "web", "phone");
const OUT_DIR = path.join(TOOL_DIR, "public", "screenshots", "android", "phone");

/** capture-web.mjs의 OUT_W/OUT_H, ios-status-bar.mjs의 SRC_W/SRC_H와 같아야 한다. */
const SRC_W = 1080;
const SRC_H = 2400;
const BAR_H = 136;

const CY = 68; // 아이콘·시각의 세로 중심
const TIME_X = 40; // 왼쪽 여백
const TIME_SIZE = 42;
const RIGHT_PAD = 40;

const TIME_TEXT = "9:41";

/** 신호 막대 4개 — Android는 왼쪽이 짧고 오른쪽이 길다(iOS와 방향은 같다). */
function signal(rightX) {
  const barW = 8;
  const gap = 6;
  const heights = [12, 18, 24, 30];
  const totalW = heights.length * barW + (heights.length - 1) * gap;
  const x0 = rightX - totalW;
  const baseline = CY + 15;
  return heights
    .map((h, i) => {
      const x = x0 + i * (barW + gap);
      return `<rect x="${x}" y="${baseline - h}" width="${barW}" height="${h}" rx="1.5" fill="#000"/>`;
    })
    .join("");
}

/** 와이파이 — Android도 동일한 부채꼴 아이콘을 쓴다. */
function wifi(rightX) {
  const rOuter = 24;
  const spread = 60 * (Math.PI / 180);
  const halfW = rOuter * Math.sin(spread);
  const cx = rightX - halfW;
  const cyb = CY + 10;

  const arc = (r) => {
    const dx = r * Math.sin(spread);
    const dy = r * Math.cos(spread);
    const x1 = (cx - dx).toFixed(2);
    const x2 = (cx + dx).toFixed(2);
    const y = (cyb - dy).toFixed(2);
    return `<path d="M ${x1} ${y} A ${r} ${r} 0 0 1 ${x2} ${y}" fill="none" stroke="#000" stroke-width="5.5" stroke-linecap="round"/>`;
  };

  return `${arc(rOuter)}${arc(15)}<circle cx="${cx}" cy="${cyb}" r="4.5" fill="#000"/>`;
}

/** 배터리 — Android는 테두리가 iOS보다 각지고 단자가 짧다. */
function battery(rightX) {
  const bodyW = 52;
  const bodyH = 26;
  const nubW = 5;
  const bodyX = rightX - nubW - bodyW;
  const bodyY = CY - bodyH / 2;
  const inset = 4;
  return [
    `<rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="4" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="3"/>`,
    `<rect x="${bodyX + inset}" y="${bodyY + inset}" width="${bodyW - inset * 2}" height="${bodyH - inset * 2}" rx="1.5" fill="#000"/>`,
    `<rect x="${bodyX + bodyW + 1}" y="${CY - 5}" width="${nubW}" height="10" rx="1.5" fill="#000" fill-opacity="0.4"/>`,
  ].join("");
}

function statusBarSvg(bg) {
  const batteryRight = SRC_W - RIGHT_PAD;
  const wifiRight = batteryRight - 52 - 5 - 22;
  const signalRight = wifiRight - 38 - 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SRC_W}" height="${BAR_H}">
  <rect width="${SRC_W}" height="${BAR_H}" fill="${bg}"/>
  <text x="${TIME_X}" y="${CY + TIME_SIZE * 0.35}" text-anchor="start"
        font-family="Roboto, Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="${TIME_SIZE}" font-weight="500" fill="#000">${TIME_TEXT}</text>
  ${signal(signalRight)}
  ${wifi(wifiRight)}
  ${battery(batteryRight)}
</svg>`;
}

/** 화면마다 상태바 배경이 다르다. 왼쪽 위에서 뽑아 쓴다 (ios-status-bar.mjs와 동일). */
async function sampleBarBackground(file) {
  const { data } = await sharp(file)
    .extract({ left: 4, top: 4, width: 2, height: 2 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(data[0])}${hex(data[1])}${hex(data[2])}`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith(".png")).sort();
  if (files.length === 0) throw new Error(`소스 캡처가 없다: ${SRC_DIR}`);

  for (const name of files) {
    const src = path.join(SRC_DIR, name);
    const meta = await sharp(src).metadata();
    if (meta.width !== SRC_W || meta.height !== SRC_H) {
      throw new Error(`${name}: ${meta.width}x${meta.height} — ${SRC_W}x${SRC_H}가 아니라 상태바 좌표가 맞지 않는다`);
    }

    const bg = await sampleBarBackground(src);
    const bar = await sharp(Buffer.from(statusBarSvg(bg))).png().toBuffer();
    const out = await sharp(src)
      .composite([{ input: bar, top: 0, left: 0 }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(path.join(OUT_DIR, name), out);
    process.stdout.write(`[android-status-bar] ${name.padEnd(14)} bg=${bg} → ${(out.length / 1024).toFixed(0)} KB\n`);
  }

  process.stdout.write(`[android-status-bar] ${files.length}장 완료 → public/screenshots/android/phone/\n`);
}

main().catch((err) => {
  console.error(`[android-status-bar] 실패: ${err.message}`);
  process.exit(1);
});
