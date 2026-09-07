import { readFileSync } from "node:fs";

const fastfile = readFileSync(new URL("../fastlane/Fastfile", import.meta.url), "utf8");

function laneBody(name, nextLane) {
  const start = fastfile.indexOf(`lane :${name} do`);
  const end = nextLane ? fastfile.indexOf(`lane :${nextLane} do`, start) : fastfile.length;
  if (start < 0 || end < 0) throw new Error(`Fastfile lane not found: ${name}`);
  return fastfile.slice(start, end);
}

// Fastfile의 레인 정의 순서대로 짝을 맞춘다 (다음 레인 이름이 본문의 끝 경계다).
for (const [name, nextLane] of [
  ["release", "metadata"],
  ["metadata", "submit"],
  ["submit", null],
]) {
  const body = laneBody(name, nextLane);
  if (!body.includes("skip_screenshots: !screenshots_ready?")) {
    throw new Error(`${name} lane must keep the empty screenshot guard`);
  }
  if (!body.includes("overwrite_screenshots: true")) {
    throw new Error(`${name} lane must overwrite screenshots on deliver retries`);
  }
}

console.log("Fastfile screenshot retry guard verified");
