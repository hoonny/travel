/* 상하이 여행 일정 웹앱 — 트리플 스타일 타임라인 + 네이버지도 연동 */

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

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

/* ---------- 구글지도 열기 (앱 설치 시 앱, 아니면 웹) ---------- */
function openMap(query) {
  if (!query) return;
  const q = encodeURIComponent(query);
  const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
  window.open(url, "_blank", "noopener");
}

/* ---------- 렌더 ---------- */
function mapButton(query) {
  if (!query) return "";
  return `<div class="actions"><button class="btn-map" data-q="${esc(
    encodeURIComponent(query)
  )}">${PIN}<span>구글지도에서 열기</span></button></div>`;
}

function childHTML(k) {
  return `<div class="child">
    <h4>${esc(k.title)}</h4>
    ${k.ko ? `<div class="ko">${esc(k.ko)}</div>` : ""}
    ${k.desc ? `<div class="desc">${esc(k.desc)}</div>` : ""}
    ${
      k.map
        ? `<button class="mini-map" data-q="${esc(
            encodeURIComponent(k.map)
          )}">${PIN}<span>지도</span></button>`
        : ""
    }
  </div>`;
}

function itemHTML(it) {
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

  return `<div class="item">
    <div class="rail"><span class="dot" style="--accent:${c.color}"></span></div>
    <div class="body" style="--accent:${c.color}">
      <div class="time">${esc(it.time || "")}</div>
      <div class="card" style="--accent:${c.color}">
        <span class="badge">${c.icon} ${c.label}</span>
        <h3>${esc(it.title)}</h3>
        ${it.ko ? `<div class="ko">${esc(it.ko)}</div>` : ""}
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ""}
        ${tips}
        ${addr}
        ${kids}
        ${mapButton(it.map)}
      </div>
    </div>
  </div>`;
}

function renderDay(idx) {
  const d = DAYS[idx];
  const real = d.items.filter((i) => i.type !== "note");
  const spots = real.filter((i) => i.map).length;

  app.innerHTML = `
    <div class="day-head">
      <h2>${esc(d.title)} <span>${esc(d.dow)}</span></h2>
      <span>${real.length}개 일정 · 장소 ${spots}곳</span>
    </div>
    ${d.items.map(itemHTML).join("")}
  `;

  [...tabs.children].forEach((b, i) => b.classList.toggle("active", i === idx));
  tabs.children[idx]?.scrollIntoView({ inline: "center", block: "nearest" });
  window.scrollTo(0, 0);
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

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-q]");
  if (!el) return;
  openMap(decodeURIComponent(el.dataset.q));
});

function syncOffsets() {
  const h = document.querySelector(".app-header").offsetHeight;
  document.documentElement.style.setProperty("--hh", h + "px");
}
window.addEventListener("resize", syncOffsets);

syncOffsets();
renderDay(0);
