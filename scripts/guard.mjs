#!/usr/bin/env node
/**
 * Spindle 금지 패턴 스캐너 — AGENTS.md 절대 원칙의 기계적 강제 장치.
 * 사용처: git pre-commit hook, Claude Code PostToolUse hook, npm run check.
 * 의존성 없음. 소스 디렉터리가 아직 없으면 조용히 통과한다 (Phase 1 이전).
 * 위반 발견 시 exit 2 (Claude hook은 stderr를 모델에 피드백, pre-commit은 커밋 거부).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

// [패턴, 설명, 적용 범위] — 범위 "web"은 클라이언트 전용 금지(프록시에선 허용)
// 기관명 텍스트는 공식 출처 표기에 허용·필수다. CI/BI 로고와 운영 주체 오인은 맥락 검토 대상이라 기계적으로 스캔하지 않는다.
const RULES = [
  [/locationBasedList2?/, "좌표 기반 TourAPI 엔드포인트 금지 (절대 원칙 2)", "all"],
  [/serviceKey/i, "클라이언트에 인증키 관련 코드 금지 — 키는 프록시 환경변수에만 (절대 원칙 4)", "web"],
  [/mapX|mapY/i, "사용자 좌표를 API 파라미터로 보내는 코드 금지 (절대 원칙 1)", "web"],
];

// 스캔 대상: 클라이언트(web)와 프록시(proxy) 소스. dist/node_modules 제외.
const TARGETS = [
  { dir: "web", scope: "web" },
  { dir: "proxy", scope: "proxy" },
  { dir: "src", scope: "web" }, // 모노레포가 아닌 단일 구조로 스캐폴딩된 경우 대비
];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".html", ".css", ".json", ".svelte", ".vue"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".wrangler", "coverage"]);
// 락파일 제외: integrity 해시(무작위 base64)가 mapX 등 패턴에 오탐된다. 코드가 아니므로 스캔 불필요.
const SKIP_FILES = new Set(["package-lock.json"]);
/**
 * Capacitor가 `cap sync`로 복사해 넣는 웹 빌드 산출물. dist의 사본이라 원본을 이미 스캔했고,
 * 번들된 코드는 소스가 아니다(git에도 커밋되지 않음 — android/.gitignore).
 * 네이티브 소스(java/kotlin/swift)는 계속 스캔 대상으로 남긴다.
 */
const SKIP_PATH_SUFFIXES = [join("app", "src", "main", "assets", "public")];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (SKIP_PATH_SUFFIXES.some((suffix) => p.endsWith(suffix))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (!SKIP_FILES.has(name) && [...EXTS].some((e) => name.endsWith(e))) yield p;
  }
}

const violations = [];
let scanned = 0;

for (const { dir, scope } of TARGETS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    scanned++;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/guard-allow/.test(line)) return; // 의도적 예외는 주석으로 명시 + 리뷰에서 사유 확인
      for (const [re, msg, ruleScope] of RULES) {
        if (ruleScope !== "all" && ruleScope !== scope) continue;
        if (re.test(line)) violations.push(`${relative(ROOT, file)}:${i + 1}  [${re.source}] ${msg}`);
      }
    });
  }
}

if (scanned === 0) {
  console.log("guard: 소스 디렉터리 없음 (Phase 1 이전) — 통과");
  process.exit(0);
}
if (violations.length > 0) {
  console.error(`guard: 금지 패턴 ${violations.length}건 발견 — AGENTS.md 절대 원칙 위반\n`);
  for (const v of violations) console.error("  " + v);
  console.error("\n수정 후 다시 시도하세요. 의도적 예외는 해당 줄에 'guard-allow' 주석 + 사유를 남기세요.");
  process.exit(2);
}
console.log(`guard: ${scanned}개 파일 검사 — 위반 없음`);
