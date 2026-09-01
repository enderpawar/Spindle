/**
 * App Store용 iPhone 스크린샷을 헤드리스로 뽑아 fastlane 경로에 넣는다.
 *
 * 이 에디터의 내보내기는 html-to-image에 묶여 있어 브라우저 없이는 렌더링이 안 된다.
 * 그래서 next dev를 띄우고 Playwright(headless Chromium)로 "Export bundle"을 눌러
 * zip을 받은 뒤, 필요한 해상도/로케일만 골라 푼다. 사람이 UI를 클릭하는 것과 결과가 같다.
 *
 * 실행: npm run export:ios   (tools/store-screenshots 에서)
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
const OUT_DIR = path.join(REPO_ROOT, "fastlane", "screenshots", "ios", "ko");

const PORT = 3123;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// App Store Connect가 6.9"로 받는 크기. 에디터의 EXPORT_SIZES.iphone 첫 항목과 같다.
const WANTED_SIZE = "1320x2868";
const WANTED_LOCALE = "ko";

function log(msg) {
  process.stdout.write(`[export-ios] ${msg}\n`);
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

/** 슬라이드 순서대로 출력 파일명을 만든다. deliver는 파일명 알파벳 순으로 업로드한다. */
function outputNames(project) {
  const slides = project.slidesByDevice?.iphone ?? [];
  return slides.map((slide, i) => {
    const raw = path.basename(String(slide.screenshot ?? ""), ".png");
    // "0_splash" → "splash" (앞의 번호는 우리가 다시 붙인다)
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
    // next dev는 자식 프로세스를 남기므로 트리째 종료한다
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
  // 1) 프로젝트 파일을 iPhone 덱으로 전환한다.
  //    에디터는 localStorage를 먼저 읽지만 새 브라우저 컨텍스트에는 캐시가 없어
  //    파일 내용이 그대로 반영된다.
  const original = await readFile(PROJECT_FILE, "utf8");
  await writeFile(BACKUP_FILE, original);
  const project = JSON.parse(original);

  const slides = project.slidesByDevice?.iphone ?? [];
  if (slides.length === 0) throw new Error("iphone 덱에 슬라이드가 없다");
  log(`iPhone 슬라이드 ${slides.length}장, 로케일 ${project.locales?.join(",")}`);

  project.device = "iphone";
  project.orientation = "portrait";
  await writeFile(PROJECT_FILE, JSON.stringify(project, null, 2));

  // 2) 개발 서버 기동
  log(`next dev 기동 (:${PORT})`);
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: TOOL_DIR,
    shell: true,
    stdio: "ignore",
  });
  await waitForServer(BASE_URL);
  log("서버 응답 확인");

  // 3) 헤드리스 브라우저에서 내보내기
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

  log("Export bundle 실행 (6.9\"/6.5\"/6.3\"/6.1\" 4개 크기를 모두 굽는다)");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 900_000 }),
    exportButton.click(),
  ]);

  const zipPath = path.join(os.tmpdir(), `spindle-shots-${Date.now()}.zip`);
  await download.saveAs(zipPath);
  log(`zip 수신: ${path.basename(zipPath)}`);

  // 4) 원하는 해상도/로케일만 골라 푼다
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const prefix = `ios/iphone/${WANTED_SIZE}/${WANTED_LOCALE}/`;
  const entries = Object.keys(zip.files)
    .filter((p) => p.startsWith(prefix) && p.endsWith(".png"))
    .sort();

  if (entries.length === 0) {
    const available = [...new Set(Object.keys(zip.files).map((p) => p.split("/").slice(0, 4).join("/")))];
    throw new Error(`zip에 ${prefix} 가 없다. 들어 있는 경로: ${available.join(", ")}`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // 이전 산출물 제거 — 슬라이드 수가 줄었을 때 옛 파일이 남으면 스토어에 섞인다
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith(".png")) await unlink(path.join(OUT_DIR, f));
  }

  const names = outputNames(project);
  const written = [];
  for (let i = 0; i < entries.length; i++) {
    const buf = await zip.files[entries[i]].async("nodebuffer");
    const name = names[i] ?? `${String(i + 1).padStart(2, "0")}_screen.png`;
    // 에디터(html-to-image)는 RGBA로 굽는데 App Store Connect는 알파 채널이 있는
    // 스크린샷을 거부한다("Invalid Screenshot ... can't contain an alpha channel").
    // 알파는 전부 255라 채널만 떼면 화면은 그대로다.
    const flat = await sharp(buf).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(OUT_DIR, name), flat);
    written.push({ name, bytes: flat.length });
  }

  await unlink(zipPath).catch(() => {});

  log(`저장 완료 → fastlane/screenshots/ios/ko/ (${written.length}장)`);
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
    console.error(`[export-ios] 실패: ${err.message}`);
    await cleanup();
    process.exit(1);
  });
