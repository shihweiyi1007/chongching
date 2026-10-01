// 行程表頁：不需要地圖，逐日列出每一站的名稱、說明與高德／Google 連結。

function itemHtml(s, i) {
  const flag = (s.alt ? '<span class="tag tag-alt">備案</span>' : '')
    + (s.approx ? '<span class="tag tag-warn">位置概略</span>' : '');
  const zh = s.zh && !s.outside ? `<div class="zh">高德名稱：<span lang="zh-Hans">${esc(s.zh)}</span></div>` : '';
  const addr = s.addr ? `<div class="zh">地址：${esc(s.addr)}</div>` : '';
  return `<li class="tl-item${s.alt ? ' tl-alt' : ''}">
    <span class="tl-dot"></span>
    <div class="tl-time">${esc(s.time || String(i + 1).padStart(2, '0'))}</div>
    <div class="tl-body">
      <h3>${esc(s.name)}${s.type ? `<span class="tag">${esc(TYPE_LABEL[s.type] || '')}</span>` : ''}${flag}</h3>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
      ${zh}${addr}
      ${linkButtons(s, { withSearch: true })}
    </div>
  </li>`;
}

const today = todayIndex();

document.getElementById('dayJump').innerHTML = TRIP.days.map((d, i) =>
  `<a href="#day-${i}" class="${i === today ? 'selected' : ''}"><i style="--c:${d.color}"></i>${esc(d.date)}<small>${esc(d.weekday)}</small></a>`).join('');

document.getElementById('schedule').innerHTML = TRIP.days.map((d, i) => `
  <section class="day-card" id="day-${i}" style="--c:${d.color}">
    <header class="day-head">
      <div><span>DAY ${i + 1}${i === today ? ' · 今天' : ''}</span><h2>${esc(d.date)}（${esc(d.weekday)}）</h2></div>
      <b>${esc(d.area)}</b>
    </header>
    <ol class="timeline">${dayStops(i).map(itemHtml).join('')}</ol>
  </section>`).join('');

document.getElementById('extras').innerHTML = TRIP.extras.map(x =>
  `<a class="btn" target="_blank" rel="noopener" href="${esc(amapSearchUrl(x.zh))}">${esc(x.name)}</a>`).join('');

// 讓錨點跳轉停在固定頁首下方
function syncHeadHeight() {
  document.documentElement.style.setProperty('--head-h', `${document.getElementById('stickyHead').offsetHeight + 8}px`);
}
syncHeadHeight();
window.addEventListener('resize', syncHeadHeight);

// 旅程期間打開時直接捲到今天
if (today > 0 && !location.hash) document.getElementById(`day-${today}`).scrollIntoView({ behavior: 'instant' });
