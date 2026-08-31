/* 상하이 여행 일정 웹앱 — 트리플 스타일 타임라인 + 상단 동선 지도 + 구글지도 연동 */

const CAT = {
  food: { label: "맛집", icon: "🍽", color: "#ff7a00" },
  cafe: { label: "카페", icon: "☕", color: "#a1673b" },
  sight: { label: "관광", icon: "📸", color: "#2b7fff" },
  shop: { label: "쇼핑", icon: "🛍", color: "#f5427d" },
  hotel: { label: "숙소", icon: "🏨", color: "#7c5cff" },
  move: { label: "이동", icon: "🚕", color: "#12b886" },
  spa: { label: "휴식", icon: "💆", color: "#00a9b7" },
  note: { label: "메모", icon: "📝", color: "#8b95a1" },
};

const PIN =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C7.9 2 4.5 5.3 4.5 9.4c0 5.3 6.4 11.6 6.7 11.9.5.4 1.2.4 1.6 0 .3-.3 6.7-6.6 6.7-11.9C19.5 5.3 16.1 2 12 2zm0 10.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"/></svg>';

const app = document.getElementById("app");
const tabs = document.getElementById("dayTabs");
const mapPanel = document.getElementById("mapPanel");
const mapToggle = document.getElementById("mapToggle");
const legInfo = document.getElementById("legInfo");

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

/* ===== 도장깨기(스탬프) 상태 ===== */
const STAMP_KEY = "shx_stamps";
let stamps = (() => {
  try {
    return JSON.parse(localStorage.getItem(STAMP_KEY) || "{}");
  } catch (_) {
    return {};
  }
})();
function saveStamps() {
  try {
    localStorage.setItem(STAMP_KEY, JSON.stringify(stamps));
  } catch (_) {}
}
const stampId = (dayIdx, it) => `${dayIdx}::${it.title}`;
const realItems = (d) => d.items.filter((i) => i.type !== "note");
let curDay = 0;

function overallPct() {
  let total = 0;
  let done = 0;
  DAYS.forEach((d, di) => {
    realItems(d).forEach((it) => {
      total += 1;
      if (stamps[stampId(di, it)]) done += 1;
    });
  });
  return total ? Math.round((done / total) * 100) : 0;
}

function sealSVG(c) {
  return `<svg viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="37" fill="#fff" stroke="#e0323c" stroke-width="3"/>
    <circle cx="40" cy="40" r="30.5" fill="none" stroke="#e0323c" stroke-width="1.4"/>
    <text x="40" y="35" text-anchor="middle" font-size="21">${c.icon}</text>
    <text x="40" y="55" text-anchor="middle" font-size="12" font-weight="800" fill="#e0323c">완료</text>
  </svg>`;
}
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

/* ---------- 상단 동선 지도 (Leaflet) ---------- */
let lmap = null;
let routeLayer = null;
let legLayer = null;
let markers = [];
let dayLL = [];
let moverRAF = null;

const MODE_ICON = { walk: "🚶", car: "🚕", boat: "⛴" };
const MODE_WORD = { walk: "걷기", car: "차량", boat: "배" };

function refreshMap() {
  if (lmap) lmap.invalidateSize();
}

function initMap() {
  if (typeof L === "undefined") {
    document.getElementById("map").innerHTML =
      '<div style="padding:24px;font-size:12px;color:#8b95a1;text-align:center">지도를 불러오지 못했어요.<br>네트워크 상태를 확인해 주세요.</div>';
    mapToggle.style.display = "none";
    return;
  }
  lmap = L.map("map", { zoomControl: false, attributionControl: true });
  lmap.attributionControl.setPrefix(false);
  L.control.zoom({ position: "topright" }).addTo(lmap);

  const primary = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }
  ).addTo(lmap);

  // 기본 타일이 반복 실패하면 OSM 타일로 1회 대체
  let errs = 0;
  let swapped = false;
  primary.on("tileerror", () => {
    if (swapped || ++errs < 6) return;
    swapped = true;
    lmap.removeLayer(primary);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(lmap);
  });

  routeLayer = L.layerGroup().addTo(lmap);
  legLayer = L.layerGroup().addTo(lmap);
}

/* 지도 패널 펼치기 (지도는 sticky라 스크롤 점프 불필요) */
function openMapPanel() {
  if (mapPanel.classList.contains("collapsed")) {
    applyCollapsed(false);
    try {
      localStorage.setItem("shx_map2", "0");
    } catch (_) {}
  }
  // sticky가 안 먹는 예외 상황에서만 살짝 스크롤
  const r = mapPanel.getBoundingClientRect();
  if (r.bottom < 60 || r.top > window.innerHeight - 60) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* 카드로 스크롤 (고정 헤더/지도 높이만큼 보정) + 잠깐 하이라이트 */
function scrollToCardEl(card) {
  if (!card) return;
  const item = card.closest(".item") || card;
  const chrome =
    document.querySelector(".app-header").offsetHeight +
    document.querySelector(".day-tabs").offsetHeight +
    mapPanel.offsetHeight +
    12;
  const top = item.getBoundingClientRect().top + window.scrollY - chrome;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 1400);
}
function scrollToCard(mi) {
  scrollToCardEl(app.querySelector(`.card[data-mi="${mi}"]`));
}

function clearLeg() {
  if (moverRAF) cancelAnimationFrame(moverRAF);
  moverRAF = null;
  if (legLayer) legLayer.clearLayers();
  if (legInfo) legInfo.hidden = true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDist = (m) =>
  m >= 1000 ? (m / 1000).toFixed(1) + "km" : Math.round(m) + "m";

/* Valhalla 인코딩 폴리라인(정밀도 6) 디코더 */
function decodeShape(str, precision) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords = [];
  const factor = Math.pow(10, precision || 6);
  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

/* Valhalla (FOSSGIS) — 도보/차량 실제 경로 */
async function fetchValhalla(a, b, costing) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6500);
  try {
    const body = {
      locations: [
        { lat: a.lat, lon: a.lng },
        { lat: b.lat, lon: b.lng },
      ],
      costing,
      directions_options: { units: "kilometers" },
    };
    const url =
      "https://valhalla1.openstreetmap.de/route?json=" +
      encodeURIComponent(JSON.stringify(body));
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await res.json();
    const leg = j && j.trip && j.trip.legs && j.trip.legs[0];
    if (leg && leg.shape) {
      return {
        pts: decodeShape(leg.shape, 6),
        dist: j.trip.summary.length * 1000,
        dur: j.trip.summary.time,
      };
    }
  } catch (_) {
    clearTimeout(t);
  }
  return null;
}

/* OSRM (차량) 폴백 */
async function fetchOSRM(a, b) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      `${a.lng},${a.lat};${b.lng},${b.lat}` +
      "?overview=full&geometries=geojson";
    const res = await fetch(url, { signal: ctrl.signal });
    const j = await res.json();
    clearTimeout(t);
    if (j.code === "Ok" && j.routes && j.routes[0]) {
      const rt = j.routes[0];
      return {
        pts: rt.geometry.coordinates.map((c) => [c[1], c[0]]),
        dist: rt.distance,
        dur: rt.duration,
      };
    }
  } catch (_) {
    clearTimeout(t);
  }
  return null;
}

/* 지정된 이동수단으로 경로 조회 (boat는 라우팅 없이 직선) */
async function fetchRoute(a, b, mode) {
  if (mode === "boat") return null;
  const v = await fetchValhalla(a, b, mode === "walk" ? "pedestrian" : "auto");
  if (v) return v;
  const o = await fetchOSRM(a, b);
  if (o) return o;
  return null;
}

/* 경로 위를 이동하는 아이콘 애니메이션 */
function animateAlong(pts, mode, onDone) {
  if (moverRAF) cancelAnimationFrame(moverRAF);
  const mover = L.marker(pts[0], {
    icon: L.divIcon({
      className: "mover",
      html: MODE_ICON[mode] || "🚶",
      iconSize: [24, 24],
    }),
    interactive: false,
    keyboard: false,
  }).addTo(legLayer);

  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = lmap.distance(pts[i - 1], pts[i]);
    segs.push(d);
    total += d;
  }
  if (!total) return;

  const dur = 2600;
  let start = 0;
  const step = (ts) => {
    if (!start) start = ts;
    const t = Math.min(1, (ts - start) / dur);
    const target = t * total;
    let acc = 0;
    let i = 0;
    while (i < segs.length && acc + segs[i] < target) acc += segs[i++];
    if (i >= segs.length) {
      mover.setLatLng(pts[pts.length - 1]);
    } else {
      const f = segs[i] ? (target - acc) / segs[i] : 0;
      mover.setLatLng([
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ]);
    }
    if (t < 1) {
      moverRAF = requestAnimationFrame(step);
    } else {
      moverRAF = null;
      if (onDone) onDone();
    }
  };
  moverRAF = requestAnimationFrame(step);
}

/* 카드 → 다음 장소까지 경로 표시 */
let legToken = 0;
async function showLeg(mi) {
  if (!lmap || !markers[mi] || !markers[mi + 1]) return;
  const my = ++legToken;
  openMapPanel();
  clearLeg();
  legInfo.textContent = "경로 찾는 중…";
  legInfo.hidden = false;

  const A = markers[mi].getLatLng();
  const B = markers[mi + 1].getLatLng();
  const straight = A.distanceTo(B);
  const dest = dayLL[mi + 1] || {};
  // 일정표에 적힌 이동수단 우선, 없으면 거리로 추정(900m 미만 도보)
  const mode = dest.moveBy || (straight < 900 ? "walk" : "car");

  await sleep(300);
  if (my !== legToken) return;
  lmap.invalidateSize();

  const r = await fetchRoute(A, B, mode);
  if (my !== legToken) return;
  let pts;
  let label;
  const icon = MODE_ICON[mode] || "🚶";
  const word = MODE_WORD[mode] || "이동";
  if (r) {
    pts = r.pts;
    label = `${icon} ${word} ${fmtDist(r.dist)} · 약 ${Math.max(
      1,
      Math.round(r.dur / 60)
    )}분`;
  } else {
    pts = [
      [A.lat, A.lng],
      [B.lat, B.lng],
    ];
    label = `${icon} ${word} · 직선거리 ${fmtDist(straight)}`;
  }

  L.polyline(pts, {
    color: "#2b7fff",
    weight: 5,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(legLayer);
  L.circleMarker(pts[0], {
    radius: 6,
    weight: 2,
    color: "#fff",
    fillColor: "#12b886",
    fillOpacity: 1,
  }).addTo(legLayer);
  L.circleMarker(pts[pts.length - 1], {
    radius: 6,
    weight: 2,
    color: "#fff",
    fillColor: "#f5427d",
    fillOpacity: 1,
  }).addTo(legLayer);

  const maxZ = straight < 500 ? 18 : straight < 1200 ? 17 : 16;
  lmap.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: maxZ });
  legInfo.textContent = label;
  legInfo.hidden = false;
  animateAlong(pts, mode, () => scrollToCard(mi + 1));
}

function pinIcon(n, cat) {
  const c = CAT[cat] || CAT.note;
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin2" style="--c:${c.color}">
      <span class="pin2-emoji">${c.icon}</span>
      <span class="pin2-num">${n}</span>
    </div>`,
    iconSize: [40, 46],
    iconAnchor: [20, 44],
    popupAnchor: [0, -42],
  });
}

function popupHTML(p, n) {
  return `<div class="mp-pop">
    <b>${n}. ${esc(p.title)}</b>
    ${p.ko ? `<span>${esc(p.ko)}</span>` : ""}
    ${p.time ? `<span>${esc(p.time)}</span>` : ""}
  </div>`;
}

function drawRoute(dayIdx) {
  if (!lmap) return;
  routeLayer.clearLayers();
  clearLeg();
  markers = [];

  const pts = DAYS[dayIdx].items.filter((i) => Array.isArray(i.ll));
  dayLL = pts;
  const coords = pts.map((p) => p.ll);

  pts.forEach((p, i) => {
    const m = L.marker(p.ll, {
      icon: pinIcon(i + 1, p.cat),
      title: p.title,
      riseOnHover: true,
    })
      .bindPopup(popupHTML(p, i + 1), { className: "cute-pop" })
      .addTo(routeLayer);
    markers.push(m);
  });

  if (coords.length > 1) {
    L.polyline(coords, {
      color: "#ff8fab",
      weight: 4,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
      dashArray: "1 12",
    }).addTo(routeLayer);
  }

  const fit = () => {
    lmap.invalidateSize();
    if (coords.length > 1) {
      lmap.fitBounds(L.latLngBounds(coords), { padding: [34, 34], maxZoom: 15 });
    } else if (coords.length === 1) {
      lmap.setView(coords[0], 15);
    } else {
      lmap.setView([31.23, 121.47], 12);
    }
  };
  requestAnimationFrame(fit);
  [120, 400, 900].forEach((ms) => setTimeout(fit, ms));
}

/* ---------- 일정 리스트 렌더 ---------- */
function childHTML(k) {
  return `<div class="child">
    <h4>${esc(k.title)}</h4>
    ${k.ko ? `<div class="ko">${esc(k.ko)}</div>` : ""}
    ${k.desc ? `<div class="desc">${esc(k.desc)}</div>` : ""}
  </div>`;
}

function itemHTML(dayIdx, it, mi, nextTitle) {
  if (it.type === "note") {
    return `<div class="item">
      <div class="rail"><span class="dot" style="--accent:${CAT.note.color}"></span></div>
      <div class="body">
        <div class="note-card"><b>${esc(it.title || "메모")}</b>${esc(
      it.desc || ""
    )}</div>
      </div>
    </div>`;
  }

  const c = CAT[it.cat] || CAT.note;
  const tips = it.tips?.length
    ? `<ul class="tips">${it.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";
  const addr = it.addr
    ? `<div class="addr">${PIN}<span>${esc(it.addr)}</span></div>`
    : "";
  const kids = it.children?.length
    ? `<div class="children">${it.children.map(childHTML).join("")}</div>`
    : "";
  const hasLoc = mi >= 0;
  const badgeNum = hasLoc ? `<span class="badge-num">${mi + 1}</span> ` : "";
  const jump = hasLoc
    ? `<div class="map-jump">${PIN}<span>지도에서 위치 보기</span></div>`
    : "";
  const leg = nextTitle
    ? `<button type="button" class="leg-btn" data-leg="${mi}">🚶 다음 장소로 이동 <b>${esc(
        nextTitle
      )}</b> →</button>`
    : "";

  const sid = stampId(dayIdx, it);
  const doneAt = stamps[sid];
  const doneLine = doneAt
    ? `<div class="done-at">✓ ${hhmm(doneAt)} 도장 완료</div>`
    : "";

  return `<div class="item">
    <div class="rail"><span class="dot" style="--accent:${c.color}"></span></div>
    <div class="body" style="--accent:${c.color}">
      <div class="time">${esc(it.time || "")}</div>
      <div class="card${hasLoc ? " has-loc" : ""}${
    doneAt ? " done" : ""
  }" style="--accent:${c.color}" data-stamp="${esc(sid)}"${
    hasLoc ? ` data-mi="${mi}"` : ""
  }>
        <span class="badge">${badgeNum}${c.icon} ${c.label}</span>
        <h3>${esc(it.title)}</h3>
        ${it.ko ? `<div class="ko">${esc(it.ko)}</div>` : ""}
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ""}
        ${tips}
        ${addr}
        ${kids}
        ${jump}
        ${leg}
        <button type="button" class="stamp-btn" data-stampbtn="${esc(
          sid
        )}">🧧 도장 찍기</button>
        ${doneLine}
        <div class="stamp-seal">${sealSVG(c)}</div>
      </div>
    </div>
  </div>`;
}

function renderDay(idx) {
  curDay = idx;
  const d = DAYS[idx];
  const real = d.items.filter((i) => i.type !== "note");
  const llItems = d.items.filter((i) => Array.isArray(i.ll));

  let n = -1;
  const rows = d.items
    .map((it) => {
      if (!Array.isArray(it.ll)) return itemHTML(idx, it, -1, null);
      n += 1;
      const next = llItems[n + 1] ? llItems[n + 1].title : null;
      return itemHTML(idx, it, n, next);
    })
    .join("");

  app.innerHTML = `
    <div class="day-head">
      <h2>${esc(d.title)} <span>${esc(d.dow)}</span></h2>
      <span>${real.length}개 일정 · 지도 마커 ${llItems.length}곳</span>
    </div>
    <section class="stamp-board" id="stampBoard"></section>
    ${rows}
  `;

  renderBoard(idx);

  [...tabs.children].forEach((b, i) => b.classList.toggle("active", i === idx));
  tabs.children[idx]?.scrollIntoView({ inline: "center", block: "nearest" });
  window.scrollTo(0, 0);

  drawRoute(idx);
}

/* ===== 오늘의 스탬프 보드 ===== */
function renderBoard(idx) {
  const board = document.getElementById("stampBoard");
  if (!board) return;
  const items = realItems(DAYS[idx]);
  const done = items.filter((it) => stamps[stampId(idx, it)]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const slots = items
    .map((it) => {
      const id = stampId(idx, it);
      const on = !!stamps[id];
      const c = CAT[it.cat] || CAT.note;
      return `<button type="button" class="sb-slot${
        on ? " on" : ""
      }" data-goto="${esc(id)}" style="--accent:${c.color}" title="${esc(
        it.title
      )}">${on ? c.icon : ""}</button>`;
    })
    .join("");

  board.innerHTML = `
    <div class="sb-head">
      <b>🗺️ 오늘의 도장</b>
      <span>${done}/${items.length} · 전체 ${overallPct()}%</span>
    </div>
    <div class="sb-rack">${slots}</div>
    <div class="sb-bar"><i style="width:${pct}%"></i></div>
  `;
}

function dayComplete(idx) {
  const items = realItems(DAYS[idx]);
  return items.length > 0 && items.every((it) => stamps[stampId(idx, it)]);
}

/* 도장 애니메이션 */
function punch(cardEl) {
  const seal = cardEl.querySelector(".stamp-seal");
  if (seal) {
    seal.classList.remove("punch");
    void seal.offsetWidth;
    seal.classList.add("punch");
  }
  cardEl.classList.remove("shake");
  void cardEl.offsetWidth;
  cardEl.classList.add("shake");
  setTimeout(() => cardEl.classList.remove("shake"), 480);
}

function toggleStamp(id, cardEl) {
  const nowDone = !stamps[id];
  if (nowDone) stamps[id] = Date.now();
  else delete stamps[id];
  saveStamps();

  cardEl.classList.toggle("done", nowDone);
  const at = cardEl.querySelector(".done-at");
  if (nowDone) {
    if (!at) {
      const seal = cardEl.querySelector(".stamp-seal");
      const div = document.createElement("div");
      div.className = "done-at";
      div.textContent = `✓ ${hhmm(stamps[id])} 도장 완료`;
      cardEl.insertBefore(div, seal);
    }
    punch(cardEl);
  } else if (at) {
    at.remove();
  }

  renderBoard(curDay);
  if (nowDone && dayComplete(curDay)) celebrate(curDay);
}

/* Day 완주 축하 */
function celebrate(idx) {
  const toast = document.createElement("div");
  toast.className = "day-toast";
  toast.textContent = `Day ${idx + 1} 완주! 🎉 오늘 도장 올클리어`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);

  const wrap = document.createElement("div");
  wrap.className = "confetti-wrap";
  const colors = ["#ff8fab", "#2b7fff", "#12b886", "#ffb703", "#7c5cff", "#e0323c"];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.5 + "s";
    p.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3400);
}

/* ---------- init ---------- */
DAYS.forEach((d, i) => {
  const b = document.createElement("button");
  b.className = "day-tab";
  b.type = "button";
  b.innerHTML = `<b>Day ${i + 1}</b><span>${esc(d.short)}</span>`;
  b.addEventListener("click", () => renderDay(i));
  tabs.appendChild(b);
});

/* 카드 탭 → 위 지도에서 해당 위치로 확대 */
function focusOnMap(mi) {
  if (!lmap || !markers[mi]) return;
  openMapPanel();
  clearLeg();
  setTimeout(() => {
    lmap.invalidateSize();
    const m = markers[mi];
    lmap.setView(m.getLatLng(), 16, { animate: true });
    m.openPopup();
  }, 280);
}

app.addEventListener("click", (e) => {
  // 1) 도장 찍기 버튼
  const sBtn = e.target.closest(".stamp-btn");
  if (sBtn) {
    toggleStamp(sBtn.dataset.stampbtn, sBtn.closest(".card"));
    return;
  }
  // 2) 완료 도장(seal) 탭 → 도장 취소
  const seal = e.target.closest(".card.done .stamp-seal");
  if (seal) {
    const c = seal.closest(".card");
    toggleStamp(c.dataset.stamp, c);
    return;
  }
  // 3) 스탬프 보드 슬롯 → 해당 카드로 스크롤
  const slot = e.target.closest(".sb-slot");
  if (slot) {
    scrollToCardEl(
      app.querySelector(`.card[data-stamp="${cssEsc(slot.dataset.goto)}"]`)
    );
    return;
  }
  // 4) 다음 장소 이동
  const legBtn = e.target.closest(".leg-btn");
  if (legBtn) {
    showLeg(Number(legBtn.dataset.leg));
    return;
  }
  // 5) 카드 탭 → 지도에서 위치 보기
  const card = e.target.closest(".card.has-loc");
  if (card) focusOnMap(Number(card.dataset.mi));
});

const cssEsc = (s) =>
  window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"');

/* 지도 접기/펼치기 */
function applyCollapsed(collapsed) {
  mapPanel.classList.toggle("collapsed", collapsed);
  mapToggle.textContent = collapsed ? "지도 펼치기 ▼" : "지도 접기 ▲";
}
mapToggle.addEventListener("click", () => {
  const collapsed = !mapPanel.classList.contains("collapsed");
  applyCollapsed(collapsed);
  try {
    localStorage.setItem("shx_map2", collapsed ? "1" : "0");
  } catch (_) {}
  if (!collapsed && lmap) setTimeout(() => lmap.invalidateSize(), 220);
});

function syncOffsets() {
  const h = document.querySelector(".app-header").offsetHeight;
  const t = document.querySelector(".day-tabs").offsetHeight;
  document.documentElement.style.setProperty("--hh", h + "px");
  document.documentElement.style.setProperty("--th", t + "px");
}
window.addEventListener("resize", syncOffsets);
window.addEventListener("resize", refreshMap);
window.addEventListener("load", () => setTimeout(refreshMap, 100));

syncOffsets();
initMap();
try {
  applyCollapsed(localStorage.getItem("shx_map2") === "1");
} catch (_) {}
renderDay(0);
[150, 500, 1200].forEach((ms) => setTimeout(refreshMap, ms));
