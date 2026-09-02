/**
 * Android 소스 캡처의 상태바를 iOS 상태바로 갈아 끼운다.
 *
 * 스토어 스크린샷의 원본은 Android 에뮬레이터(Pixel 7, 1080x2400) 캡처다. 그대로 쓰면
 * iPhone 목업 안에 Android식 신호 삼각형·배터리·알림 아이콘이 보이고, Apple은 다른 기기의
 * UI가 섞인 스토어 이미지를 리젝 사유로 삼는다(App Store 심사 지침 2.3.3).
 *
 * 실기기 재촬영이 정답이지만 개발 머신이 Windows라 iOS 캡처를 뽑을 수 없다. 대신 앱 화면은
 * 건드리지 않고 **상단 상태바 띠만** iOS 규격으로 다시 그린다. 상태바는 앱 콘텐츠가 아니라
 * OS 크롬이라 이 교체는 앱의 기능을 다르게 보이게 하지 않는다.
 *
 * 실행: npm run capture:ios   (tools/store-screenshots 에서)
 * 결과: public/screenshots/ios/phone/*.png  — 에디터의 iphone 덱이 이 경로를 본다.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(TOOL_DIR, "public", "screenshots", "android", "phone");
const OUT_DIR = path.join(TOOL_DIR, "public", "screenshots", "ios", "phone");

/** 소스 캡처 해상도 (Pixel 7). 다른 값이 들어오면 좌표가 어긋나므로 검사한다. */
const SRC_W = 1080;
const SRC_H = 2400;

/**
 * Android 상태바 띠의 높이. x=10 열에서 배경색이 처음 바뀌는 행이 136이었다 —
 * 즉 0..135가 상태바고 136부터 앱 화면이다. 이 아래로는 손대지 않는다.
 */
const BAR_H = 136;

/**
 * iOS 상태바 치수. iPhone 16 Pro(402pt 폭)의 실측값을 1080px 기준으로 환산했다.
 * 환산 계수 k = 1080 / 402 = 2.687.
 */
const CY = 66; // 아이콘·시각의 세로 중심
const TIME_X = 180; // 노치 왼쪽 "귀" 영역의 가로 중심 (67pt)
const TIME_SIZE = 46; // 17pt
const RIGHT_PAD = 44; // 배터리 오른쪽 여백

/** Apple이 마케팅 자료에 쓰는 시각. 스토어 스크린샷의 관례다. */
const TIME_TEXT = "9:41";

/** 셀룰러 4칸 — 오른쪽으로 갈수록 길어진다. */
function cellular(rightX) {
  const barW = 9;
  const gap = 5;
  const heights = [12, 19, 26, 32];
  const totalW = heights.length * barW + (heights.length - 1) * gap;
  const x0 = rightX - totalW;
  const baseline = CY + 16;
  return heights
    .map((h, i) => {
      const x = x0 + i * (barW + gap);
      return `<rect x="${x}" y="${baseline - h}" width="${barW}" height="${h}" rx="2.5" fill="#000"/>`;
    })
    .join("");
}

/** 와이파이 — 부채꼴 호 2개와 아래 점. 호는 중심에서 ±60° 를 그린다. */
function wifi(rightX) {
  const rOuter = 26;
  const spread = 60 * (Math.PI / 180);
  const halfW = rOuter * Math.sin(spread);
  const cx = rightX - halfW;
  const cyb = CY + 11; // 점의 중심. 호의 꼭대기는 cyb - rOuter 가 된다

  const arc = (r) => {
    const dx = r * Math.sin(spread);
    const dy = r * Math.cos(spread);
    const x1 = (cx - dx).toFixed(2);
    const x2 = (cx + dx).toFixed(2);
    const y = (cyb - dy).toFixed(2);
    return `<path d="M ${x1} ${y} A ${r} ${r} 0 0 1 ${x2} ${y}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/>`;
  };

  return `${arc(rOuter)}${arc(17)}<circle cx="${cx}" cy="${cyb}" r="5" fill="#000"/>`;
}

/** 배터리 — 테두리(35% 검정) + 꽉 찬 내부 + 오른쪽 단자. */
function battery(rightX) {
  const bodyW = 69;
  const bodyH = 33;
  const nubW = 6;
  const bodyX = rightX - nubW - bodyW;
  const bodyY = CY - bodyH / 2;
  const inset = 5;
  return [
    `<rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="11" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="3.5"/>`,
    `<rect x="${bodyX + inset}" y="${bodyY + inset}" width="${bodyW - inset * 2}" height="${bodyH - inset * 2}" rx="7" fill="#000"/>`,
    `<path d="M ${bodyX + bodyW + 1.5} ${CY - 6.5} a 5 5 0 0 1 0 13 z" fill="#000" fill-opacity="0.35"/>`,
  ].join("");
}

function statusBarSvg(bg) {
  const batteryRight = SRC_W - RIGHT_PAD;
  const wifiRight = batteryRight - 69 - 6 - 20;
  const cellularRight = wifiRight - 45 - 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SRC_W}" height="${BAR_H}">
  <rect width="${SRC_W}" height="${BAR_H}" fill="${bg}"/>
  <text x="${TIME_X}" y="${CY + TIME_SIZE * 0.35}" text-anchor="middle"
        font-family="Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="${TIME_SIZE}" font-weight="600" fill="#000">${TIME_TEXT}</text>
  ${cellular(cellularRight)}
  ${wifi(wifiRight)}
  ${battery(batteryRight)}
</svg>`;
}

/** 화면마다 상태바 배경이 다르다(스플래시는 흰색, 나머지는 #FAFAFA). 왼쪽 위에서 뽑아 쓴다. */
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
    process.stdout.write(`[ios-status-bar] ${name.padEnd(14)} bg=${bg} → ${(out.length / 1024).toFixed(0)} KB\n`);
  }

  process.stdout.write(`[ios-status-bar] ${files.length}장 완료 → public/screenshots/ios/phone/\n`);
}

main().catch((err) => {
  console.error(`[ios-status-bar] 실패: ${err.message}`);
  process.exit(1);
});
