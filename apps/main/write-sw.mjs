import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = await readdir("dist/assets");
const files = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/brand.svg",
  "/fridge-mark.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/fridge-touch-v2.png",
  "/fridge-icon-192-v2.png",
  "/fridge-icon-512-v2.png",
  ...assets.map((a) => "/assets/" + a),
];
// Include public images as well as bundles so logo-only updates invalidate offline caches.
const hash = createHash("sha256");
for (const file of files) {
  const relative = file.slice(1);
  hash.update(file);
  hash.update(await readFile("dist/" + (relative || "index.html")));
}
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='fridgeful-${version}';const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fridgeful-')&&!k.startsWith('fridgeful-camera-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!ASSETS.includes(u.pathname))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.headers.get('content-type')?.includes('text/html')){const copy=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy))}return r}).catch(()=>caches.match('/index.html')));return;}
e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});`,
);
console.log("Offline app shell generated:", version);
