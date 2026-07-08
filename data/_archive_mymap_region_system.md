# [ARCHIVED] MyMap World map: region-based navigation system (retired 2026-07-08)

This file preserves the "region picker → region map" navigation system that MyMap's
World mode used before it was replaced with a single continuous Mercator world map
(horizontal infinite-scroll + pinch-zoom). It is **not loaded by the app** (plain
`.md`, not `.js`) and has zero effect on runtime behavior. Kept only in case a future
feature wants a region-scoped view again (e.g. a "jump to continent" shortcut, or a
fallback for very old browsers/devices where the continuous map underperforms).

## Why this was retired

The user wanted a map in a more familiar orientation/shape (continuous Mercator,
scrollable like a real map) instead of picking a region tile first. See
`tavi_mymap_ui_roadmap` project memory for the full discussion. The six region data
files (`data/world-asia.js`, `world-europe.js`, `world-africa.js`,
`world-north_america.js`, `world-south_america.js`, `world-oceania.js`) were **not
deleted** and still contain valid per-country path data (Wikimedia-derived for
Asia/Africa, Natural Earth/Winkel-Tripel-derived for the other four) — only the
`MYMAP_REGIONS`-driven navigation UI around them was removed from `index.html`.

## Archived code (as it existed in index.html immediately before removal)

### State + region table

```js
let myMapMapMode = "jp";      // "jp" | "world"
let myMapWorldRegion = null;  // null(リージョン選択中) | "east_asia" 等
const MYMAP_REGIONS = [
  { code:"east_asia",     dataFile:"asia", icon:"🌏", ready:true,
    codes:["JP","KR","KP","CN","MN","TW","HK","MO","VN","LA","KH","TH","MM","MY","SG","ID","PH","BN","TL"],
    viewBox:"1776.5 278.4 591.3 595.7" },
  { code:"west_asia",     dataFile:"asia", icon:"🐫", ready:true,
    codes:["IN","PK","BD","LK","NP","BT","MV","AF","KZ","UZ","TM","TJ","KG","SA","AE","QA","KW","BH","OM","YE","IQ","IR","IL","JO","LB","SY","TR","GE","AM","AZ","PS","CY"],
    viewBox:"1436.9 263.6 574.9 492.7" },
  { code:"europe",        dataFile:"europe", icon:"🏰", ready:true },
  { code:"africa",        dataFile:"africa", icon:"🦁", ready:true },
  { code:"north_america", dataFile:"north_america", icon:"🗽", ready:true },
  { code:"south_america", dataFile:"south_america", icon:"🏔️", ready:true },
  { code:"oceania",       dataFile:"oceania", icon:"🏝️", ready:true },
];
```

### Multi-file lazy loader (one `<script>` per region, injected on demand)

```js
const MYMAP_WORLD_LOADED = {}; // dataFile -> true(読み込み済み)
function loadWorldRegionScript(dataFile){
  if(MYMAP_WORLD_LOADED[dataFile] || window["WORLD_"+dataFile.toUpperCase()]) { MYMAP_WORLD_LOADED[dataFile]=true; return Promise.resolve(); }
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=`data/world-${dataFile}.js`;
    s.onload=()=>{ MYMAP_WORLD_LOADED[dataFile]=true; resolve(); };
    s.onerror=()=>reject(new Error("load failed: "+dataFile));
    document.head.appendChild(s);
  });
}
```

### Region open/close

```js
async function openMyMapWorldRegion(code){
  const region = MYMAP_REGIONS.find(r=>r.code===code);
  if(!region || !region.ready){ toast(t('x.map.regionComingSoon')); return; }
  try{ await loadWorldRegionScript(region.dataFile); }
  catch(e){ console.log("[world map] load error:", e); toast(t('x.map.regionComingSoon')); return; }
  myMapWorldRegion = code;
  rerenderMyMapInPlace();
}
function closeMyMapWorldRegion(){ myMapWorldRegion = null; rerenderMyMapInPlace(); }
```

(`setMyMapMapMode(mode)` also used to clear `myMapWorldRegion` when switching to
`"jp"` — that single line was removed, the function itself still exists.)

### Region-filtered draw + region-relative score coloring

```js
function drawMyMapWorld(regionCode){
  const region = MYMAP_REGIONS.find(r=>r.code===regionCode); if(!region) return;
  const fullArr = window["WORLD_"+region.dataFile.toUpperCase()];
  const c = document.getElementById("myMapWorld"); if(!c || !fullArr) return;
  const codeSet = region.codes ? new Set(region.codes) : null;
  const arr = codeSet ? fullArr.filter(co=>codeSet.has(co.code)) : fullArr;
  const scores = MYMAP_COUNTRY_SCORES;
  // 濃さの基準(最高スコア)は、今表示している地域内の国だけから求める(他地域の訪問実績に
  // 引っ張られて、この地域内の一番濃いはずの国が薄く表示されてしまわないように)
  const scoreVals = arr.map(co=>scores[co.code]).filter(Boolean).map(myMapScore);
  const maxScore = scoreVals.length ? Math.max(...scoreVals) : 1;
  const paths = arr.map(co=>{
    const row = scores[co.code];
    let cls="";
    if(row){ const r=myMapScore(row)/maxScore; cls = r<=.2?"m1":r<=.4?"m2":r<=.6?"m3":r<1?"m4":"m5"; }
    const name = curLang()==="ja" ? co.name_ja : co.name_en;
    const title = row ? `${name}(${t('x.trip.stopNights',{n:row.night_count})})` : name;
    return `<path d="${co.d}" class="${cls}"><title>${esc(title)}</title></path>`;
  }).join("");
  const vb = region.viewBox || window["WORLD_"+region.dataFile.toUpperCase()+"_VIEWBOX"];
  c.innerHTML = `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
  resetMapZoom("myMapWorld");
}
```

### Region picker grid + region-selected body

```js
function myMapWorldBodyHTML(){
  if(!myMapWorldRegion){
    return `<div class="badge-grid" style="grid-template-columns:repeat(3,1fr)">
      ${MYMAP_REGIONS.map(r=>`<div class="badge-item ${r.ready?'':'locked'}" onclick="openMyMapWorldRegion('${r.code}')">
        <div class="badge-ic" style="background:linear-gradient(135deg,#8b5cf6,#c4b5fd)">${r.icon}</div>
        <div class="bn">${esc(t('x.map.region.'+r.code))}</div>
      </div>`).join("")}
    </div>
    <p class="muted" style="text-align:center;margin-top:10px">${t('x.map.regionPickNote')}</p>`;
  }
  const region = MYMAP_REGIONS.find(r=>r.code===myMapWorldRegion);
  const fullCodes = (window["WORLD_"+region.dataFile.toUpperCase()]||[]).map(co=>co.code);
  const codes = region.codes ? region.codes.filter(c=>fullCodes.includes(c)) : fullCodes;
  const visitedCodes = codes.filter(code=>MYMAP_COUNTRY_SCORES[code]);
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <button class="room-back" onclick="closeMyMapWorldRegion()"><span class="back-arrow">←</span></button>
      <span style="font-weight:700;color:var(--ink)">${esc(t('x.map.region.'+myMapWorldRegion))}</span>
    </div>
    <div class="gi-prog" style="margin-top:0">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-size:14px;font-weight:700;color:var(--ink)">${t('x.map.countriesVisited',{n:visitedCodes.length})}</span>
        <span style="font-size:13px;color:var(--accent);font-weight:800">${visitedCodes.length} / ${codes.length}</span>
      </div>
      <div class="bar"><i style="width:${codes.length?Math.round(visitedCodes.length/codes.length*100):0}%"></i></div>
    </div>
    <div class="mapwrap mymap-visual" id="myMapWorld" style="margin-top:12px"></div>
    ${visitedCodes.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${visitedCodes.map(code=>{
        const row=MYMAP_COUNTRY_SCORES[code];
        return `<span class="chip">${esc(curLang()==="ja"?row.name:row.name_en)}</span>`;
      }).join("")}</div>`:`<p class="muted" style="text-align:center;margin-top:8px">${t('x.map.overseasNote')}</p>`}`;
}
```

## i18n keys that became unused after removal

`x.map.region.east_asia` / `west_asia` / `europe` / `africa` / `north_america` /
`south_america` / `oceania`, `x.map.regionComingSoon`, `x.map.regionPickNote`,
`x.map.countriesVisited`, `x.map.overseasNote`. These were left in place in
`index.html`'s i18n dictionaries rather than deleted, to keep this archive's code
runnable if ever restored (ja/en key-count parity is unaffected either way since
both languages kept the same keys).

## How to restore

1. Copy the code blocks above back into `index.html` in place of the continuous-map
   equivalents (`drawMyMapWorld`, the world-mode branch of `myMapWorldBodyHTML`,
   the world-map dynamic loader).
2. Restore `MYMAP_WORLD_LOADED` and point `loadWorldRegionScript` back at the six
   `data/world-*.js` files (still present, untouched, in this same `data/` folder).
3. Re-add the `myMapWorldRegion` state variable and the open/close functions above.
