(function () {
  var title = document.getElementById("nav-title");
  var tabbar = document.querySelector(".tabbar");
  var name = document.getElementById("me-name");
  var avatars = [document.getElementById("me-avatar"), document.getElementById("set-avatar")];

  function syncTab() {
    var active = document.querySelector(".tab.active");
    if (!active) return;
    document.body.setAttribute("data-tab", active.getAttribute("data-tab"));
    title.textContent = active.querySelector("span").textContent;
  }

  function syncScroll() {
    document.body.classList.toggle("scrolled", window.scrollY > 40);
    document.documentElement.style.setProperty("--sp", Math.min(window.scrollY / 320, 1).toFixed(3));
  }

  // 스크롤하면 섹션이 한 번만 부드럽게 올라와요
  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("js-reveal");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    var seen = new WeakSet();
    var scan = function () {
      document.querySelectorAll(".view[data-view='home'] .group, .report-card").forEach(function (el) {
        if (!seen.has(el)) { seen.add(el); io.observe(el); }
      });
    };
    scan();
    setTimeout(function () { document.querySelectorAll(".group,.report-card").forEach(function (el) { el.classList.add("in"); }); }, 4000);
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  function syncAvatar() {
    var text = (name.textContent || "").trim();
    var first = text ? Array.from(text)[0].toUpperCase() : "";
    avatars.forEach(function (a) { if (a) a.textContent = first; });
  }

  new MutationObserver(syncTab).observe(tabbar, { attributes: true, subtree: true, attributeFilter: ["class"] });
  new MutationObserver(syncAvatar).observe(name, { childList: true, characterData: true, subtree: true });
  window.addEventListener("scroll", syncScroll, { passive: true });
  syncTab();
  syncScroll();
  syncAvatar();

  // 연속 곡률(스쿼클) 모서리 — 원호가 아니라 초타원으로 모서리를 그려요
  var SEL = [".btn",".rsvp",".seg",".seg button",".tab",".tabbar",".card",".stat",".sm-select",".chip",".name-pill",".pay-btn",".poke-btn",".chk",
    ".search-form input",".week-stepper",".composer",".photo-btn",".sheet",".modal",".place-card",".set-group",".mem-list",".inv-list",".law-list",".search-results",".cal-day",
    ".card input:not([type=checkbox]):not([type=radio]):not([type=file])",".card select",".card textarea",".modal input",".modal select",".modal textarea",
    ".sheet input:not([type=checkbox]):not([type=radio]):not([type=file])",".sheet select",".sheet textarea",".gate-card input",".gate-card select"].join(",");
  var N = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--squircle")) || 3, STEPS = 14, info = new WeakMap(), cache = {}, KEYS = ["TopLeft","TopRight","BottomRight","BottomLeft"];
  function squircle(w, h, r) {
    var key = w + "|" + h + "|" + r.join(",");
    if (cache[key]) return cache[key];
    var m = Math.min(w, h) / 2, e = r.map(function (v) { return Math.min(v, m); }), pts = [];
    var cx = [e[0], w - e[1], w - e[2], e[3]], cy = [e[0], e[1], h - e[2], h - e[3]];
    var corner = [[0, 0], [w, 0], [w, h], [0, h]];
    for (var k = 0; k < 4; k++) {
      if (!e[k]) { pts.push(corner[k]); continue; }
      for (var i = 0; i <= STEPS; i++) {
        var t = (Math.PI / 2) * i / STEPS, c = Math.pow(Math.cos(t), 2 / N), s = Math.pow(Math.sin(t), 2 / N), x, y;
        if (k === 0) { x = cx[k] - e[k] * c; y = cy[k] - e[k] * s; }
        else if (k === 1) { x = cx[k] + e[k] * s; y = cy[k] - e[k] * c; }
        else if (k === 2) { x = cx[k] + e[k] * c; y = cy[k] + e[k] * s; }
        else { x = cx[k] - e[k] * s; y = cy[k] + e[k] * c; }
        pts.push([x, y]);
      }
    }
    var d = "M" + pts.map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join("L") + "Z";
    return (cache[key] = "path('" + d + "')");
  }
  function paint(el) {
    var i = info.get(el); if (!i) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    el.style.clipPath = w && h ? squircle(w, h, i.r) : "";
  }
  var CAN = !!(window.CSS && CSS.supports && CSS.supports("clip-path", "path('M0 0L1 0L1 1Z')"));
  var ro = CAN && "ResizeObserver" in window ? new ResizeObserver(function (es) { es.forEach(function (e) { paint(e.target); }); }) : null;
  function adopt(el) {
    if (info.has(el)) return;
    var cs = getComputedStyle(el), r = KEYS.map(function (k) { return parseFloat(cs["border" + k + "Radius"]) || 0; });
    if (!r.some(Boolean)) { info.set(el, null); return; }
    info.set(el, { r: r });
    el.style.borderRadius = "0";
    if (ro) ro.observe(el);
    paint(el);
  }
  var queued = false;
  function scanShapes() {
    if (queued) return; queued = true;
    requestAnimationFrame(function () { queued = false; document.querySelectorAll(SEL).forEach(adopt); });
  }
  if (ro) { scanShapes(); window.addEventListener("load", scanShapes); new MutationObserver(scanShapes).observe(document.body, { childList: true, subtree: true }); }
})();
