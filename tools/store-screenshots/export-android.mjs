/**
 * Google Play용 Android 폰 스크린샷을 헤드리스로 뽑아 fastlane 경로에 넣는다.
 *
 * export-ios.mjs와 같은 방식(next dev + headless Chromium으로 Export bundle 클릭)이다.
 * 차이는 두 곳뿐이다: 에디터 device를 "android"로 전환하고, 받은 zip에서 android 폰
 * 크기(1080x1920, 로케일 없음 — constants.ts EXPORT_SIZES.android)만 골라 쓴다.
 *
 * 실행: npm run export:android   (tools/store-screenshots 에서)
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import JSZip from "jszip";
import sharp from "sharp";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const PROJECT_FILE = path.join(TOOL_DIR, "app-store-screenshots.json");
const BACKUP_FILE = path.join(os.tmpdir(), "spindle-screenshots-project.backup.json");
const OUT_DIR = path.join(REPO_ROOT, "fastlane", "metadata", "android", "ko-KR", "images", "phoneScreenshots");

const PORT = 3124;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// 에디터의 android 덱은 크기가 하나뿐이다 (constants.ts EXPORT_SIZES.android).
const WANTED_SIZE = "1080x1920";
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

/** fastlane supply는 파일명 알파벳 순으로 업로드한다. */
function outputNames(project) {
  const slides = project.slidesByDevice?.android ?? [];
  return slides.map((slide, i) => {
    const raw = path.basename(String(slide.screenshot ?? ""), ".png");
    const label = raw.replace(/^\d+_/, "") || `screen${i + 1}`;
    return `${String(i + 1).padStart(2, "0")}_${label}.png`;
  });
}

let server = null;
let browser = null;
let restored = false;

async function restoreProject() {
  if (restored) return;
  restored = true;
  if (existsSync(BACKUP_FILE)) {
    await copyFile(BACKUP_FILE, PROJECT_FILE);
    log("app-store-screenshots.json 원복 완료");
  }
}

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  if (server && !server.killed) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
    server = null;
  }
  await restoreProject();
}

async function main() {
  const original = await readFile(PROJECT_FILE, "utf8");
  await writeFile(BACKUP_FILE, original);
  const project = JSON.parse(original);

  const slides = project.slidesByDevice?.android ?? [];
  if (slides.length === 0) throw new Error("android 덱에 슬라이드가 없다");
  log(`Android 슬라이드 ${slides.length}장, 로케일 ${project.locales?.join(",")}`);

  project.device = "android";
  project.orientation = "portrait";
  await writeFile(PROJECT_FILE, JSON.stringify(project, null, 2));

  log(`next dev 기동 (:${PORT})`);
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: TOOL_DIR,
    shell: true,
    stdio: "ignore",
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
  // detectPlatform("android") === "android" → 경로가 android/android/... 가 된다 (defaults.ts).
  const prefix = `android/android/${WANTED_SIZE}/${WANTED_LOCALE}/`;
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

  await mkdir(OUT_DIR, { recursive: true });
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith(".png")) await unlink(path.join(OUT_DIR, f));
  }

  const written = [];
  for (const { entry, name } of planned) {
    const buf = await zip.files[entry].async("nodebuffer");
    // Play Console도 알파 채널이 있는 스크린샷을 거부한다. iOS 파이프라인과 같은 이유로 뗀다.
    const flat = await sharp(buf).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(OUT_DIR, name), flat);
    written.push({ name, bytes: flat.length });
  }

  await unlink(zipPath).catch(() => {});

  log(`저장 완료 → fastlane/metadata/android/ko-KR/images/phoneScreenshots/ (${written.length}장)`);
  for (const w of written) {
    log(`  ${w.name.padEnd(20)} ${(w.bytes / 1024).toFixed(0)} KB`);
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
