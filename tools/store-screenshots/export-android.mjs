/**
 * Google Play용 스크린샷을 App Store와 같은 iPhone 덱으로 헤드리스로 뽑아 fastlane 경로에 넣는다.
 *
 * export-ios.mjs와 같은 방식(next dev + headless Chromium으로 Export bundle 클릭)이다.
 * 차이는 캔버스 폭 하나다. App Store 규격 1320x2868은 Play 규정 "긴 변이 짧은 변의 2배를
 * 넘을 수 없다"(2868 > 2640)에 걸리므로, 캔버스만 CANVAS_W로 넓혀(constants.ts
 * NEXT_PUBLIC_IPHONE_CANVAS_W) 모든 요소를 좌우 가운데로 옮겨 굽는다. 기기 틀·캡션·크기는
 * App Store 이미지와 같고(글자·그림자·눈금판 크기는 constants.ts scaleWidth가 1320 기준으로
 * 고정), 넓어진 좌우에는 배경만 이어진다 — 이미지 가장자리를 복사해 붙이면 눈금판의 방위
 * 글자와 선이 뒤집혀 보여서 쓰지 않는다.
 *
 * 옮긴 좌표는 app-store-screenshots.json에 쓰지 않는다. 임시 사본을 만들어 next dev에
 * SCREENSHOTS_PROJECT_FILE로 넘기고(api/project/route.ts), 자동 저장도 그 사본에 쌓인다.
 * 원본을 고쳐 쓰면 중간에 죽었을 때 +61px이 남고, 다음 실행이 그 위에 또 더해 App Store
 * 이미지까지 어긋난다. Playwright page.route로 /api/project를 가로채는 방법은 쓰지 않는다 —
 * 그렇게 돌린 두 번 모두 01~03이 스핀 화면 한 장으로 똑같이 나왔다(라우팅을 켜면 HTTP 캐시가
 * 꺼져 슬라이드 전환보다 캡처가 앞선 것으로 보인다).
 *
 * 같은 세트를 휴대전화·7인치·10인치 태블릿 슬롯에 모두 넣는다. 예전 태블릿 이미지는
 * 480px 폭 앱 양옆에 남색 여백이 찍힌 캡처였다.
 *
 * 실행: npm run export:android   (tools/store-screenshots 에서)
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import JSZip from "jszip";
import sharp from "sharp";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const PROJECT_FILE = path.join(TOOL_DIR, "app-store-screenshots.json");
const SHIFTED_PROJECT_FILE = path.join(os.tmpdir(), "spindle-screenshots-project.play.json");
const IMAGES_DIR = path.join(REPO_ROOT, "fastlane", "metadata", "android", "ko-KR", "images");
const OUT_DIRS = ["phoneScreenshots", "sevenInchScreenshots", "tenInchScreenshots"].map((d) =>
  path.join(IMAGES_DIR, d)
);

const PORT = 3124;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const IOS_CANVAS_W = 1320;
const CANVAS_H = 2868;
// 2868 / 1442 = 1.989 — 2배 경계에 딱 붙이지 않도록 조금 여유를 둔다. 좌우 61px씩 넓어진다.
const CANVAS_W = 1442;
const SHIFT_X = (CANVAS_W - IOS_CANVAS_W) / 2;
const WANTED_SIZE = `${CANVAS_W}x${CANVAS_H}`;
const WANTED_LOCALE = "ko";

function log(msg) {
  process.stdout.write(`[export-android] ${msg}\n`);
}

async function waitForServer(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return;
    } catch {
      /* 아직 안 떴다 */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`개발 서버가 ${timeoutMs}ms 안에 응답하지 않았다: ${url}`);
}

/** export-ios.mjs와 같은 이름 규칙이다. supply·Play Console 모두 파일명 순으로 올린다. */
function outputNames(project) {
  const slides = project.slidesByDevice?.iphone ?? [];
  return slides.map((slide, i) => {
    const raw = path.basename(String(slide.screenshot ?? ""), ".png");
    const label = raw.replace(/^\d+_/, "") || `screen${i + 1}`;
    return `${String(i + 1).padStart(2, "0")}_${label}.png`;
  });
}

/** 넓어진 캔버스의 가운데로 요소를 옮긴다. transform의 x는 슬라이드 왼쪽 끝 기준 px다. */
function centerOnWiderCanvas(slide) {
  for (const t of Object.values(slide.transforms ?? {})) {
    if (typeof t?.x === "number") t.x += SHIFT_X;
  }
  for (const el of slide.textElements ?? []) {
    if (typeof el.transform?.x === "number") el.transform.x += SHIFT_X;
  }
}

let server = null;
let browser = null;

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  if (server && !server.killed) {
    if (process.platform === "win32") {
      // 끝날 때까지 기다린다. 실패 경로는 곧바로 process.exit하므로, 기다리지 않으면 taskkill이
      // 돌기 전에 끝나 next dev가 포트에 남고 다음 실행이 그 서버(다른 환경변수)에 붙는다.
      await new Promise((resolve) => {
        spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" })
          .on("exit", resolve)
          .on("error", resolve);
      });
    } else {
      server.kill("SIGTERM");
    }
    server = null;
  }
  await unlink(SHIFTED_PROJECT_FILE).catch(() => {});
}

async function main() {
  const project = JSON.parse(await readFile(PROJECT_FILE, "utf8"));

  const slides = project.slidesByDevice?.iphone ?? [];
  if (slides.length === 0) throw new Error("iphone 덱에 슬라이드가 없다");
  if (project.crossScreenMockupsByDevice?.iphone?.length) {
    // 여러 화면에 걸친 목업은 슬라이드 경계 기준 좌표라 가운데 정렬 보정이 맞지 않는다.
    throw new Error("iphone 덱에 화면을 가로지르는 목업이 있다 — 이 스크립트는 그 배치를 옮기지 못한다");
  }
  log(`iPhone 슬라이드 ${slides.length}장 → ${WANTED_SIZE}, 로케일 ${project.locales?.join(",")}`);

  slides.forEach(centerOnWiderCanvas);
  project.device = "iphone";
  project.orientation = "portrait";
  await writeFile(SHIFTED_PROJECT_FILE, JSON.stringify(project, null, 2));

  const stale = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
  if (stale) {
    throw new Error(`:${PORT}에 이미 서버가 떠 있다 — 캔버스 폭·프로젝트 파일 환경변수가 없는 서버일 수 있어 중단한다`);
  }

  log(`next dev 기동 (:${PORT}, 캔버스 폭 ${CANVAS_W})`);
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: TOOL_DIR,
    shell: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_PUBLIC_IPHONE_CANVAS_W: String(CANVAS_W),
      SCREENSHOTS_PROJECT_FILE: SHIFTED_PROJECT_FILE,
    },
  });
  await waitForServer(BASE_URL);
  log("서버 응답 확인");

  browser = await chromium.launch();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("requestfailed", (r) => log(`request failed: ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) log(`HTTP ${r.status()}: ${r.url()}`);
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120_000 });

  const exportButton = page.getByRole("button", { name: /Export bundle/i });
  await exportButton.waitFor({ state: "visible", timeout: 120_000 });
  log("에디터 로드 완료 — 폰트 로딩 대기");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  log("Export bundle 실행");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 900_000 }),
    exportButton.click(),
  ]);

  const zipPath = path.join(os.tmpdir(), `spindle-shots-android-${Date.now()}.zip`);
  await download.saveAs(zipPath);
  log(`zip 수신: ${path.basename(zipPath)}`);

  const zip = await JSZip.loadAsync(await readFile(zipPath));
  // 경로에 크기가 들어가므로, 캔버스 폭 환경변수가 반영되지 않았으면(캐시 등) 여기서 걸린다.
  const prefix = `ios/iphone/${WANTED_SIZE}/${WANTED_LOCALE}/`;
  const entries = Object.keys(zip.files)
    .filter((p) => p.startsWith(prefix) && p.endsWith(".png"))
    .sort();

  if (entries.length === 0) {
    const available = [...new Set(Object.keys(zip.files).map((p) => p.split("/").slice(0, 4).join("/")))];
    throw new Error(`zip에 ${prefix} 가 없다. 들어 있는 경로: ${available.join(", ")}`);
  }

  if (entries.length !== slides.length) {
    throw new Error(
      `렌더 결과가 ${entries.length}장인데 슬라이드는 ${slides.length}장이다 — ` +
        "일부 슬라이드 렌더가 실패했다. 기존 산출물은 건드리지 않고 중단한다."
    );
  }

  const names = outputNames(project);
  const planned = entries.map((entry) => {
    const base = path.basename(entry);
    const m = /^(\d+)-/.exec(base);
    if (!m) throw new Error(`zip 항목 이름에서 순번을 못 읽었다: ${base}`);
    const name = names[Number(m[1]) - 1];
    if (!name) throw new Error(`순번 ${m[1]}에 대응하는 슬라이드가 없다: ${base}`);
    return { entry, name };
  });

  const images = [];
  for (const { entry, name } of planned) {
    const buf = await zip.files[entry].async("nodebuffer");
    // Play Console도 알파 채널이 있는 스크린샷을 거부한다. iOS 파이프라인과 같은 이유로 뗀다.
    const flat = await sharp(buf).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
    const { width, height } = await sharp(flat).metadata();
    if (Math.max(width, height) > 2 * Math.min(width, height)) {
      throw new Error(`${name}이 ${width}x${height}로 Play 비율 규정(긴 변 ≤ 짧은 변×2)을 어긴다`);
    }
    // 에디터가 슬라이드를 넘기기 전에 캡처하면 앞 슬라이드와 같은 PNG가 나온다(실제로 01~03이
    // 모두 스핀 화면으로 나온 적이 있다). 장수 검사로는 안 잡히니 내용이 겹치는지 본다.
    const twin = images.find((image) => image.flat.equals(flat));
    if (twin) {
      throw new Error(`${name}이 ${twin.name}과 똑같다 — 슬라이드 전환 전에 캡처됐다. 다시 실행한다.`);
    }
    images.push({ name, flat });
  }

  // 검증을 통과한 뒤에야 기존 산출물을 지운다.
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    for (const f of await readdir(dir)) {
      if (f.endsWith(".png")) await unlink(path.join(dir, f));
    }
    for (const { name, flat } of images) await writeFile(path.join(dir, name), flat);
  }

  await unlink(zipPath).catch(() => {});

  log(`저장 완료 → fastlane/metadata/android/ko-KR/images/{${OUT_DIRS.map((d) => path.basename(d)).join(",")}}/`);
  for (const { name, flat } of images) {
    log(`  ${name.padEnd(20)} ${(flat.length / 1024).toFixed(0)} KB`);
  }
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await cleanup();
    process.exit(1);
  });
}

main()
  .then(cleanup)
  .catch(async (err) => {
    console.error(`[export-android] 실패: ${err.message}`);
    await cleanup();
    process.exit(1);
  });
