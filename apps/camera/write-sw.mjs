import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "/camera/",
  "/camera/index.html",
  "/camera/manifest.webmanifest",
  "/camera/brand.svg",
  "/camera/fridge-mark.svg",
  "/camera/icon-192.png",
  "/camera/icon-512.png",
  "/camera/apple-touch-icon.png",
  ...(await readdir("dist/assets")).map((n) => "/camera/assets/" + n),
];
// Include public images as well as bundles so logo-only updates invalidate offline caches.
const hash = createHash("sha256");
for (const file of files) {
  const relative = file.slice(8);
  hash.update(file);
  hash.update(await readFile("dist/" + (relative || "index.html")));
}
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='fridgeful-camera-${version}';const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('fridgeful-camera-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!FILES.includes(u.pathname))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/camera/index.html')))}else e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});`,
);
