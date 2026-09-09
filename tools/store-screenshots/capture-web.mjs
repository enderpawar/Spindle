/**
 * 스토어 스크린샷의 앱 화면을 **배포된 웹앱에서** 직접 뽑는다.
 *
 * 기존 소스는 Android 에뮬레이터 캡처였다(ios-status-bar.mjs 주석 참고). 그래서 화면을
 * 갱신할 때마다 에뮬레이터가 필요했고, 실제로 개발 머신에 JDK·Android SDK가 없어
 * 재캡처가 막혔다. 웹앱과 네이티브 셸은 같은 번들을 쓰므로 브라우저에서 뽑아도 화면이 같다.
 *
 * 출력 규격은 기존 파이프라인과 맞춘다: 1080x2400, 상단 136px는 상태바 자리로 비워 둔다.
 * 그 자리는 ios-status-bar.mjs가 iOS 상태바로 채운다 — 다른 OS의 UI를 섞지 않으므로
 * App Store 심사지침 2.3.3 문제가 없다.
 *
 * 실행: npm run capture:web          (배포본 기준)
 *      npm run capture:web -- http://127.0.0.1:5173   (로컬 dev 서버 기준)
 * 결과: public/screenshots/web/phone/*.png  → 이어서 `npm run capture:ios -- <그 경로>`
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(TOOL_DIR, "public", "screenshots", "web", "phone");

const BASE_URL = process.argv[2] ?? "https://spindle-6vp.pages.dev";

/** 파이프라인이 기대하는 소스 규격. ios-status-bar.mjs의 SRC_W/SRC_H와 같아야 한다. */
const OUT_W = 1080;
const OUT_H = 2400;
/** 상태바가 덮을 높이. 앱 화면은 이만큼을 뺀 높이로 캡처해 아래에 붙인다. */
const BAR_H = 136;

/** DPR 3으로 1080px 폭을 만든다. 360px는 앱이 지원하는 280~480px 범위 안이다. */
const DPR = 3;
const VIEWPORT = { width: OUT_W / DPR, height: Math.ceil((OUT_H - BAR_H) / DPR) };

/** 온보딩을 건너뛰는 키 (web/src/App.tsx의 ONBOARD_KEY) */
const ONBOARD_KEY = "spindle.onboarded";

/**
 * 아이폰 홈 인디케이터 여백(34pt)을 재현한다.
 *
 * 하단 내비게이션은 `padding-bottom: max(10px, env(safe-area-inset-bottom))`인데
 * 헤드리스 브라우저에서는 inset이 0이라 10px로 얇아진다. 그러면 탭 라벨이 화면 맨
 * 아래에 붙어 목업 프레임 하단에서 잘린다. 실기기에서는 34pt가 들어가 라벨이 그만큼
 * 올라오므로, 이 주입이 오히려 실제 아이폰 화면에 가깝다.
 */
const IPHONE_SAFE_AREA_CSS = `.bottom-nav { padding-bottom: 34px !important; }`;

/**
 * 담을 화면들. 파일명은 에디터 프로젝트(app-store-screenshots.json)가 참조하는 이름과
 * 같아야 한다 — 이름이 바뀌면 슬라이드에 붙은 카피와 짝이 어긋난다.
 */
const SHOTS = [
  { file: "1_spin.png", tab: "스핀" },
  { file: "2_map.png", tab: "명소" },
  { file: "3_home.png", tab: "홈" },
  { file: "4_stamp.png", tab: "도장" },
  { file: "5_settings.png", tab: "설정" },
  // 아래 둘은 하단 탭만으로 못 가는 화면이라 탭 클릭 뒤 이동 단계를 더 밟는다.
  // steps는 캡처 직전에 실행되고, 여기서 기다린 만큼이 그대로 화면에 담긴다.
  {
    file: "6_theme.png",
    tab: "홈",
    async steps(page) {
      // 테마 그리드의 첫 카드(바다). data-theme는 engine/themes.ts의 id다.
      await page.locator('.home-theme-card[data-theme="sea"]').click();
      await page.waitForTimeout(3_000);
    },
  },
  {
    file: "7_photo.png",
    tab: "홈",
    async steps(page) {
      // 추천 여행지의 대표 카드 → 상세 → 사진 뷰어. 이름을 박으면 큐레이션이 바뀔 때
      // 조용히 깨지므로 "자세히 보기" 패턴의 첫 항목을 집는다.
      await page.getByRole("button", { name: /자세히 보기$/ }).first().click();
      await page.waitForTimeout(4_000);
      await page.getByRole("button", { name: /사진 더 보기$/ }).first().click();
      await page.waitForTimeout(3_000);
    },
  },
];

function log(msg) {
  process.stdout.write(`[capture-web] ${msg}\n`);
}

/**
 * 캡처 위에 상태바 자리를 만든다. 배경색은 캡처 첫 줄에서 뽑아 이어 붙인 자리가
 * 화면과 같은 색이 되게 한다 (ios-status-bar.mjs가 (4,4)에서 다시 샘플링한다).
 */
async function padForStatusBar(buffer) {
  const top = await sharp(buffer).extract({ left: 0, top: 0, width: 4, height: 1 }).raw().toBuffer();
  const background = { r: top[0], g: top[1], b: top[2], alpha: 1 };

  // 뷰포트를 올림했으므로 캡처가 목표보다 몇 px 클 수 있다 — 위에서부터 정확히 잘라 쓴다.
  const body = await sharp(buffer)
    .extract({ left: 0, top: 0, width: OUT_W, height: OUT_H - BAR_H })
    .toBuffer();

  return sharp(body)
    .extend({ top: BAR_H, bottom: 0, left: 0, right: 0, background })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  log(`대상: ${BASE_URL}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "light",
    // 모션을 끄면 전환 중간 프레임이 찍히는 일이 없다.
    reducedMotion: "reduce",
  });
  // 온보딩을 건너뛰어 홈에서 시작한다.
  await context.addInitScript(
    ([key]) => window.localStorage.setItem(key, "1"),
    [ONBOARD_KEY],
  );

  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // 인트로(콜드 스타트 물결)가 끝나 하단 내비게이션이 붙을 때까지 기다린다.
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await nav.waitFor({ state: "visible", timeout: 60_000 });
  await page.addStyleTag({ content: IPHONE_SAFE_AREA_CSS });
  // 세션 시작 TourAPI 목록 호출과 사진 로딩이 자리를 잡을 시간을 준다.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2_500);

  for (const { file, tab, steps } of SHOTS) {
    await nav.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    // 사진·지도 타일이 채워질 시간. 지도는 특히 늦게 온다.
    await page.waitForTimeout(tab === "명소" ? 6_000 : 3_000);
    if (steps) await steps(page);

    const raw = await page.screenshot({ type: "png" });
    await writeFile(path.join(OUT_DIR, file), await padForStatusBar(raw));
    log(`${file} (${tab})`);
  }

  await browser.close();
  log(`완료 → ${OUT_DIR}`);
  log("다음: npm run capture:ios -- public/screenshots/web/phone  그리고 npm run export:ios");
}

main().catch((err) => {
  process.stderr.write(`[capture-web] 실패: ${err?.stack ?? err}\n`);
  process.exit(1);
});
