// 地圖頁與行程表頁共用的工具：資料整理、座標換算、高德／Google 連結。

const SRC = 'cq-trip';
const AMAP_CITY = '500000'; // 重慶市 adcode

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ---- 座標換算（只給 OpenStreetMap 備援底圖用；Google 與高德直接吃 GCJ-02）----
function _tLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return r;
}
function _tLng(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return r;
}
function wgsToGcj(lat, lng) {
  const a = 6378245, ee = 0.00669342162296594323;
  const dLat = _tLat(lng - 105, lat - 35), dLng = _tLng(lng - 105, lat - 35);
  const rad = lat / 180 * Math.PI, magic = 1 - ee * Math.sin(rad) ** 2, sq = Math.sqrt(magic);
  return [
    lat + (dLat * 180) / ((a * (1 - ee)) / (magic * sq) * Math.PI),
    lng + (dLng * 180) / (a / sq * Math.cos(rad) * Math.PI),
  ];
}
// GCJ-02 沒有解析反函數，用迭代逼近，三次後誤差小於 1 公尺
function gcjToWgs(lat, lng) {
  let wLat = lat, wLng = lng;
  for (let i = 0; i < 3; i++) {
    const [gLat, gLng] = wgsToGcj(wLat, wLng);
    wLat -= gLat - lat;
    wLng -= gLng - lng;
  }
  return [wLat, wLng];
}

// ---- 連結 ----
function amapPinUrl(p) {
  const [lat, lng] = p.gcj;
  return `https://uri.amap.com/marker?position=${lng.toFixed(6)},${lat.toFixed(6)}&name=${encodeURIComponent(p.zh || p.name)}&src=${SRC}&coordinate=gaode&callnative=1`;
}
function amapSearchUrl(keyword) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=${AMAP_CITY}&src=${SRC}&callnative=1`;
}
function googlePinUrl(p) {
  const q = p.gcj && !p.approx ? `${p.gcj[0]},${p.gcj[1]}` : `${p.zh || p.name} 重庆`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
// 座標已確認的地點才用座標開高德，其餘用名稱搜尋
function hasPin(p) { return !!p.gcj && !p.approx; }
function amapUrl(p) { return hasPin(p) ? amapPinUrl(p) : amapSearchUrl(p.zh || p.name); }

function linkButtons(p, { withSearch = false } = {}) {
  if (p.outside || !(p.zh || p.gcj)) return '';
  const out = [`<a class="btn btn-amap" target="_blank" rel="noopener" href="${esc(amapUrl(p))}">${hasPin(p) ? '高德地圖' : '高德搜尋'}</a>`];
  if (withSearch && hasPin(p)) out.push(`<a class="btn" target="_blank" rel="noopener" href="${esc(amapSearchUrl(p.zh))}">搜名稱</a>`);
  out.push(`<a class="btn" target="_blank" rel="noopener" href="${esc(googlePinUrl(p))}">Google</a>`);
  return `<div class="actions">${out.join('')}</div>`;
}

// ---- 行程整理 ----
// 把一天的 items 展開成可顯示的停靠點；同一天重複出現的地點（例如住宿出發／返回）共用同一個編號
function dayStops(di) {
  const day = TRIP.days[di];
  const seen = new Map();
  let n = 0;
  return day.items.map((it, ii) => {
    const place = it.p ? PLACES[it.p] : {};
    const s = { ...place, ...it, key: it.p || null, dayIndex: di, color: day.color, id: `${di}-${ii}` };
    s.mappable = !!s.gcj && !s.outside;
    if (s.mappable) {
      if (!seen.has(s.key)) seen.set(s.key, { n: ++n, id: s.id });
      s.n = seen.get(s.key).n;
      s.markerId = seen.get(s.key).id;
      s.first = s.markerId === s.id;
    }
    return s;
  });
}

// 旅程期間回傳今天是第幾天，否則回傳 -1（以重慶／台北時區 UTC+8 計算）
function todayIndex() {
  const iso = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  return TRIP.days.findIndex(d => d.iso === iso);
}

const TYPE_LABEL = { transport: '交通', hotel: '住宿', spot: '景點', food: '餐飲', nightlife: '夜生活', relax: '放鬆' };
