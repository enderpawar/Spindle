import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "web", "dist");

function fail(message) {
  console.error(`pwa verify failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
assert(manifest.name === "Spindle", "manifest name must be Spindle");
assert(manifest.short_name === "Spindle", "manifest short_name must be Spindle");
assert(manifest.display === "standalone", "manifest display must be standalone");
assert(manifest.orientation === "portrait", "manifest orientation must be portrait");
assert(manifest.start_url === "/travel.html", "manifest start_url must be /travel.html");
assert(manifest.theme_color === "#0F2540", "manifest theme_color must match ui.md proposal");
assert(
  manifest.icons?.some(
    (icon) =>
      icon.src === "/pwa-icon-512.png" &&
      icon.sizes === "512x512" &&
      icon.type === "image/png" &&
      String(icon.purpose).includes("maskable"),
  ),
  "manifest must include a 512px maskable PNG icon",
);

const sw = readFileSync(join(dist, "sw.js"), "utf8");
assert(sw.includes("travel.html"), "service worker must precache the travel shell");
assert(sw.includes("/api") || sw.includes("\\/api"), "service worker must explicitly route /api");
assert(sw.includes("NetworkOnly"), "service worker must use NetworkOnly for /api");
assert(!sw.includes("areaBasedList2"), "service worker must not precache TourAPI endpoint names");
assert(!sw.includes("detailCommon2"), "service worker must not precache detail endpoint names");
assert(!sw.includes("detailIntro2"), "service worker must not precache detail endpoint names");
assert(!sw.includes("detailImage2"), "service worker must not precache image endpoint names");

console.log("pwa verify: manifest + service worker cache policy OK");
