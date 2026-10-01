// 地圖頁：日期切換、清單、底圖（Google 為主，沒有金鑰或載入失敗時改用 OpenStreetMap）。

let kit = null;
let activeDay = 'all';
let showRoute = true;
let panelOpen = false; // 行程清單預設收合，按日期才展開

// 地圖可移動的範圍：重慶主城區加機場（GCJ-02 與 WGS-84 在這個尺度下可視為相同）
const CITY = { south: 29.30, west: 106.25, north: 29.90, east: 106.90 };
const MIN_ZOOM = 11;

const $ = id => document.getElementById(id);

function popupHtml(s) {
  const day = TRIP.days[s.dayIndex];
  return `<div class="pop">
    <span class="pop-day" style="--c:${s.color}">${esc(day.date)}（${esc(day.weekday)}）· ${s.alt ? `備案 ${s.n}` : `第 ${s.n} 站`}</span>
    <b>${esc(s.name)}</b>
    ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
    ${s.approx ? '<p class="warn">位置為概略，請以高德搜尋結果為準。</p>' : ''}
    ${linkButtons(s)}
  </div>`;
}

// ---- 資料 → 要畫的東西 ----
function visibleDays() {
  return activeDay === 'all' ? TRIP.days.map((_, i) => i) : [activeDay];
}
function groups() {
  return visibleDays().map(di => {
    const stops = dayStops(di);
    return {
      color: TRIP.days[di].color,
      markers: stops.filter(s => s.mappable && s.first),
      path: stops.filter(s => s.mappable && !s.alt).map(s => s.gcj),
    };
  });
}

// ---- 清單 ----
function stopRow(s) {
  const pin = s.mappable
    ? `<span class="pin${s.alt ? ' pin-alt' : ''}" style="--c:${s.color}">${s.n}</span>`
    : `<span class="pin pin-off" title="不在地圖上">–</span>`;
  const flag = (s.alt ? '<span class="tag tag-alt">備案</span>' : '') + (s.approx ? '<span class="tag tag-warn">位置概略</span>' : '');
  return `<li class="stop${s.mappable ? ' is-mappable' : ''}" data-marker="${s.markerId || ''}">
    ${pin}
    <div class="stop-body">
      <div class="stop-head"><b>${esc(s.name)}</b>${s.time ? `<span class="time">${esc(s.time)}</span>` : ''}</div>
      ${flag}
      ${s.note ? `<p>${esc(s.note)}</p>` : ''}
      ${linkButtons(s)}
    </div>
  </li>`;
}
function renderList() {
  const days = visibleDays();
  let count = 0;
  $('placeList').innerHTML = days.map(di => {
    const d = TRIP.days[di], stops = dayStops(di);
    count += stops.filter(s => s.mappable && s.first).length;
    const head = days.length > 1 ? `<h3 class="list-day" style="--c:${d.color}">${esc(d.date)}（${esc(d.weekday)}）<span>${esc(d.area)}</span></h3>` : '';
    return `${head}<ol class="stops">${stops.map(stopRow).join('')}</ol>`;
  }).join('');
  const d = activeDay === 'all' ? null : TRIP.days[activeDay];
  $('listTitle').textContent = d ? `${d.date}（${d.weekday}）${d.area}` : '全部行程';
  $('placeCount').textContent = `地圖上 ${count} 個點`;
  $('panelOpen').textContent = d ? `顯示 ${d.date} 行程` : '顯示全部行程';
}
// 收合時地圖佔滿畫面，展開時行程出現在地圖下方（橫向畫面在右側）
function setPanel(open) {
  panelOpen = open;
  $('mapMain').classList.toggle('collapsed', !open);
  $('panelOpen').hidden = open;
  $('panelClose').setAttribute('aria-expanded', open);
}
function renderChips() {
  $('dayFilters').innerHTML = `<button data-day="all">全部</button>` + TRIP.days.map((d, i) =>
    `<button data-day="${i}"><i style="--c:${d.color}"></i>${esc(d.date)}<small>${esc(d.weekday)}</small></button>`).join('');
  syncChips();
}
function syncChips() {
  $('dayFilters').querySelectorAll('button').forEach(b => {
    const on = b.dataset.day === String(activeDay);
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}
function refresh() {
  renderList();
  if (kit) kit.draw(groups(), { route: showRoute });
}

// ---- 底圖：OpenStreetMap（Leaflet）。OSM 是 WGS-84，所以要把 GCJ-02 換回去 ----
function leafletKit(el) {
  const map = L.map(el, {
    zoomControl: true, minZoom: MIN_ZOOM, maxBoundsViscosity: 1, zoomSnap: 0.5,
    maxBounds: [[CITY.south, CITY.west], [CITY.north, CITY.east]],
  }).setView(gcjToWgs(29.56, 106.56), 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const index = new Map();
  const toW = g => gcjToWgs(g[0], g[1]);
  return {
    name: 'OpenStreetMap',
    draw(gs, opt) {
      map.invalidateSize({ animate: false });
      layer.clearLayers(); index.clear();
      const near = [], all = [];
      gs.forEach(g => {
        if (opt.route && g.path.length > 1) {
          L.polyline(g.path.map(toW), { color: g.color, weight: 3, opacity: 0.8, dashArray: '2 8', lineCap: 'round' }).addTo(layer);
        }
        g.markers.forEach(s => {
          const ll = toW(s.gcj);
          const m = L.marker(ll, {
            title: s.name,
            icon: L.divIcon({ className: 'pin-wrap', html: `<span class="pin${s.alt ? ' pin-alt' : ''}" style="--c:${g.color}">${s.n}</span>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }),
          }).bindPopup(popupHtml(s), { maxWidth: 270, minWidth: 210, maxHeight: Math.max(130, el.clientHeight - 80) }).addTo(layer);
          index.set(s.markerId, m);
          all.push(ll); if (!s.far) near.push(ll);
        });
      });
      // 機場離市區約 20 公里，同時有其他點時視野只對準市區
      const fit = near.length ? near : all;
      if (fit.length) map.fitBounds(fit, { padding: [26, 26], maxZoom: fit.length === 1 ? 14 : 16, animate: false });
    },
    focus(id) {
      const m = index.get(id);
      if (!m) return;
      // 不做動畫，資訊窗才能在開啟時正確把自己移進可視範圍
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 16), { animate: false });
      m.openPopup();
    },
    resize() { map.invalidateSize(); },
  };
}

// ---- 底圖：Google Maps。中國境內道路圖本身就是 GCJ-02，座標直接用 ----
function googleKit(el) {
  const map = new google.maps.Map(el, {
    center: { lat: 29.56, lng: 106.56 }, zoom: 12, minZoom: MIN_ZOOM,
    restriction: { latLngBounds: CITY, strictBounds: false },
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    gestureHandling: 'greedy', clickableIcons: false,
  });
  const info = new google.maps.InfoWindow({ maxWidth: 270 });
  const index = new Map();
  let objs = [];
  const toG = g => ({ lat: g[0], lng: g[1] });
  return {
    name: 'Google 地圖',
    draw(gs, opt) {
      objs.forEach(o => o.setMap(null)); objs = []; index.clear(); info.close();
      const near = [], all = [];
      gs.forEach(g => {
        if (opt.route && g.path.length > 1) {
          objs.push(new google.maps.Polyline({
            map, path: g.path.map(toG), strokeOpacity: 0,
            icons: [{ icon: { path: google.maps.SymbolPath.CIRCLE, scale: 2, fillColor: g.color, fillOpacity: 0.9, strokeOpacity: 0 }, offset: '0', repeat: '10px' }],
          }));
        }
        g.markers.forEach(s => {
          const m = new google.maps.Marker({
            map, position: toG(s.gcj), title: s.name,
            label: { text: String(s.n), color: s.alt ? g.color : '#fff', fontWeight: '700', fontSize: '13px' },
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: s.alt ? '#fff' : g.color, fillOpacity: 1, strokeColor: s.alt ? g.color : '#fff', strokeWeight: 2.5 },
          });
          m.addListener('click', () => { info.setContent(popupHtml(s)); info.open({ map, anchor: m }); });
          m._stop = s;
          objs.push(m); index.set(s.markerId, m);
          all.push(m.getPosition()); if (!s.far) near.push(m.getPosition());
        });
      });
      const fit = near.length ? near : all;
      if (fit.length === 1) { map.setCenter(fit[0]); map.setZoom(14); }
      else if (fit.length) {
        const b = new google.maps.LatLngBounds();
        fit.forEach(p => b.extend(p));
        map.fitBounds(b, 48);
      }
    },
    focus(id) {
      const m = index.get(id);
      if (!m) return;
      map.panTo(m.getPosition());
      if (map.getZoom() < 16) map.setZoom(16);
      info.setContent(popupHtml(m._stop)); info.open({ map, anchor: m });
    },
    resize() {},
  };
}

// ---- 載入 ----
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadCss(href) {
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href;
  document.head.appendChild(l);
}
function freshMapEl() {
  const old = $('map'), el = document.createElement('div');
  el.id = 'map';
  old.replaceWith(el);
  return el;
}
function setStatus(html) {
  const el = $('mapStatus');
  el.innerHTML = html || '';
  el.hidden = !html;
}
function start(makeKit, note) {
  kit = makeKit(freshMapEl());
  $('basemap').textContent = `底圖：${kit.name}${note ? `（${note}）` : ''}`;
  setStatus('');
  refresh();
}
async function useLeaflet(note) {
  try {
    if (!window.L) { loadCss('vendor/leaflet.css'); await loadScript('vendor/leaflet.js'); }
    start(leafletKit, note);
  } catch (e) {
    setStatus('<b>地圖載入失敗</b><br>清單與高德／Google 連結仍可使用。');
  }
}
function useGoogle(key) {
  let failed = false;
  const fallback = () => { if (!failed) { failed = true; useLeaflet('Google 地圖無法載入'); } };
  window.gm_authFailure = fallback; // 金鑰錯誤或網域不在允許清單
  window.__gmReady = () => { if (!failed) start(googleKit); };
  loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=zh-TW&callback=__gmReady`).catch(fallback);
  setTimeout(() => { if (!kit) fallback(); }, 8000); // 中國境內未翻牆時 Google 會連不上
}

function boot() {
  const t = todayIndex();
  if (t >= 0) activeDay = t;
  renderChips();
  renderList();
  setPanel(t >= 0); // 旅程期間直接展開當天行程

  // 按日期：切到那一天並展開行程；再按一次同一個日期則收合／展開
  $('dayFilters').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const day = b.dataset.day === 'all' ? 'all' : +b.dataset.day;
    if (day === activeDay) setPanel(!panelOpen);
    else { activeDay = day; setPanel(true); }
    syncChips();
    refresh();
    $('panel').scrollTop = 0;
  });
  $('panelClose').addEventListener('click', () => { setPanel(false); refresh(); });
  $('panelOpen').addEventListener('click', () => { setPanel(true); refresh(); });
  $('routeToggle').addEventListener('change', e => { showRoute = e.target.checked; refresh(); });
  $('placeList').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('.stop.is-mappable');
    if (row && kit) kit.focus(row.dataset.marker);
  });
  window.addEventListener('resize', () => kit && kit.resize());

  setStatus('地圖載入中…');
  const key = (window.GOOGLE_MAPS_KEY || '').trim();
  if (key) useGoogle(key); else useLeaflet();
}
boot();
