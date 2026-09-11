/**
 * 서명된 AAB를 Google Play에 올리고 프로덕션 트랙으로 심사 제출한다.
 *
 * fastlane supply를 쓰지 않는 이유: 이 저장소의 fastlane은 macOS 러너 전용 iOS
 * 파이프라인이고, 개발 머신(Windows)에는 Ruby가 없다. AAB는 이 머신에서 서명까지
 * 끝나 있으므로, Play Developer API를 직접 부르는 편이 CI에 키스토어를 올리는 것보다
 * 짧고 노출면도 작다.
 *
 * 인증은 서비스 계정 JSON → JWT → 액세스 토큰. 의존성 없이 node:crypto로 서명한다.
 *
 * 실행:
 *   node tools/play-upload/upload.mjs --key <서비스계정.json> [--aab <경로>] [--dry-run]
 *
 * --dry-run은 편집 세션을 열어 업로드까지 하고 commit 없이 버린다. 권한·서명·
 * versionCode 충돌을 실제 제출 전에 확인하는 용도다. Play에는 아무것도 남지 않는다.
 */
import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGE = "kr.spindle.app";
const TRACK = "production";
const LOCALE = "ko-KR";
const DEFAULT_AAB = path.join(ROOT, "web/android/app/build/outputs/bundle/release/app-release.aab");
const CHANGELOG_DIR = path.join(ROOT, "fastlane/metadata/android", LOCALE, "changelogs");

const API = "https://androidpublisher.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function log(msg) {
  process.stdout.write(`[play-upload] ${msg}\n`);
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

const base64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** 서비스 계정 JSON으로 OAuth 액세스 토큰을 받는다 (RS256 서명된 JWT bearer). */
async function accessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: creds.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${base64url(signer.sign(creds.private_key))}`;

  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`토큰 발급 실패 ${res.status}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function api(token, method, urlPath, { body, contentType, raw } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Play는 권한 부족·versionCode 중복 같은 실제 원인을 message에 담아 준다.
    const msg = parsed?.error?.message ?? text;
    throw new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
  }
  return parsed;
}

async function main() {
  const keyPath = arg("key");
  if (!keyPath) throw new Error("--key <서비스계정.json> 가 필요하다");
  const aabPath = path.resolve(arg("aab", DEFAULT_AAB));
  const dryRun = process.argv.includes("--dry-run");

  const creds = JSON.parse(await readFile(keyPath, "utf8"));
  if (!creds.client_email || !creds.private_key) {
    throw new Error("서비스 계정 JSON이 아니다 (client_email/private_key 없음)");
  }
  const aab = await readFile(aabPath);
  log(`AAB ${path.relative(ROOT, aabPath)} (${(aab.length / 1048576).toFixed(2)} MB)`);
  log(`서비스 계정 ${creds.client_email}`);

  const token = await accessToken(creds);
  log("액세스 토큰 발급 완료");

  const edit = await api(token, "POST", `/androidpublisher/v3/applications/${PACKAGE}/edits`);
  log(`편집 세션 ${edit.id}`);

  const uploaded = await api(
    token,
    "POST",
    `/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
    { contentType: "application/octet-stream", raw: aab },
  );
  const versionCode = uploaded.versionCode;
  log(`업로드 완료 — versionCode ${versionCode}`);

  // 릴리스 노트는 versionCode와 같은 이름의 파일에서 읽는다 (supply와 같은 규칙).
  const notes = (await readFile(path.join(CHANGELOG_DIR, `${versionCode}.txt`), "utf8")).trim();
  log(`릴리스 노트 ${versionCode}.txt (${notes.length}자)`);

  await api(token, "PUT", `/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}/tracks/${TRACK}`, {
    body: {
      track: TRACK,
      releases: [
        {
          versionCodes: [String(versionCode)],
          // completed = 100% 배포. 관리형 게시가 꺼져 있으므로 승인 즉시 공개된다.
          status: "completed",
          releaseNotes: [{ language: LOCALE, text: notes }],
        },
      ],
    },
  });
  log(`${TRACK} 트랙에 배정 (100%)`);

  if (dryRun) {
    await api(token, "DELETE", `/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}`);
    log("dry-run — 편집 세션을 버렸다. Play에는 아무것도 반영되지 않았다.");
    return;
  }

  await api(token, "POST", `/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}:commit`);
  log(`커밋 완료 — versionCode ${versionCode}가 심사에 들어갔다.`);
}

main().catch((error) => {
  process.stderr.write(`[play-upload] 실패: ${error.message}\n`);
  process.exit(1);
});
