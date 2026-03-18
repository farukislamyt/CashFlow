/* CashFlow Service Worker v4.0 */
'use strict';
const CACHE = 'cf-v4.0.0';
const FONTS = 'cf-fonts-v2';
const BASE  = '/CashFlow';
const SHELL = [
  BASE+'/', BASE+'/index.html', BASE+'/manifest.json',
  BASE+'/assets/css/tokens.css', BASE+'/assets/css/base.css',
  BASE+'/assets/css/nav.css', BASE+'/assets/css/components.css',
  BASE+'/assets/js/i18n.js', BASE+'/assets/js/store.js',
  BASE+'/assets/js/charts.js', BASE+'/assets/js/pdf.js',
  BASE+'/assets/js/ui.js', BASE+'/assets/js/app.js',
  BASE+'/assets/icons/icon.svg',
  BASE+'/assets/icons/icon-192.png', BASE+'/assets/icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(console.warn));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==FONTS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method!=='GET'||!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('fonts.g')) { e.respondWith(swr(req,FONTS)); return; }
  e.respondWith(cf(req));
});
async function cf(req) {
  const c = await caches.match(req,{ignoreSearch:false}); if(c) return c;
  try {
    const r = await fetch(req);
    if (r.ok && r.type!=='opaque') { const ca=await caches.open(CACHE); ca.put(req,r.clone()); }
    return r;
  } catch {
    if (req.mode==='navigate') { const f=await caches.match(BASE+'/')||await caches.match(BASE+'/index.html'); if(f) return f; }
    return new Response('{"error":"offline"}',{status:503,headers:{'Content-Type':'application/json'}});
  }
}
async function swr(req, cn) {
  const ca=await caches.open(cn), c=await ca.match(req);
  const fp=fetch(req).then(r=>{if(r.ok)ca.put(req,r.clone());return r;}).catch(()=>null);
  return c||fp;
}
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting(); });
