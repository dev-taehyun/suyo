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

  // Apple-inspired shape engine: fixed, capsule, concentric
  var SEL = [".btn",".rsvp",".seg",".seg button",".tab",".tabbar",".card",".stat",".sm-select",".chip",".name-pill",".pay-btn",".poke-btn",".chk",
    ".search-form input",".week-stepper",".composer",".photo-btn",".sheet",".modal",".place-card",".set-group",".mem-list",".inv-list",".law-list",".search-results",".cal-day",
    ".card input:not([type=checkbox]):not([type=radio]):not([type=file])",".card select",".card textarea",".modal input",".modal select",".modal textarea",
    ".sheet input:not([type=checkbox]):not([type=radio]):not([type=file])",".sheet select",".sheet textarea",".gate-card input",".gate-card select"].join(",");
  var KEYS = ["TopLeft","TopRight","BottomRight","BottomLeft"], info = new WeakMap(), observed = new Set();
  var CAPSULE = ".btn,.rsvp,.seg,.seg button,.tab,.tabbar,.sm-select,.chip,.name-pill,.pay-btn,.poke-btn,.chk,.search-form input,.week-stepper,.composer,.photo-btn";
  var CONTAINER = ".card,.stat,.sheet,.modal,.place-card,.set-group,.mem-list,.inv-list,.law-list,.search-results,.gate-card";
  function radii(el) {
    var cs = getComputedStyle(el);
    return KEYS.map(function (k) { return parseFloat(cs["border" + k + "Radius"]) || 0; });
  }
  function px(v) { return Math.max(0, parseFloat(v) || 0); }
  function shapeMode(el) {
    if (el.hasAttribute("data-shape")) return el.getAttribute("data-shape");
    if (el.matches(CAPSULE)) return "capsule";
    if (el.matches("textarea")) return "concentric";
    if (el.matches("input,select") && el.closest(CONTAINER)) return "concentric";
    if (el.matches(CONTAINER)) return "fixed";
    return "fixed";
  }
  function nearestShapeParent(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      if (observed.has(p) && p.matches(CONTAINER)) return p;
      p = p.parentElement;
    }
    return null;
  }
  function concentricRadii(el, base) {
    var parent = nearestShapeParent(el);
    if (!parent) return base;
    var pr = parent.getBoundingClientRect(), cr = el.getBoundingClientRect();
    var insets = [Math.min(cr.left-pr.left, cr.top-pr.top), Math.min(pr.right-cr.right, cr.top-pr.top), Math.min(pr.right-cr.right, pr.bottom-cr.bottom), Math.min(cr.left-pr.left, pr.bottom-cr.bottom)];
    var parentR = radii(parent);
    return base.map(function (v, i) {
      var shared = Math.max(0, parentR[i] - Math.max(0, insets[i]));
      return Math.min(v || shared, shared);
    });
  }
  function applyShape(el) {
    var data = info.get(el); if (!data) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    var r = data.base.slice(), mode = data.mode;
    if (mode === "capsule") r = [1,1,1,1].map(function () { return Math.min(w,h)/2; });
    else if (mode === "concentric") r = concentricRadii(el, r);
    var maxX = w/2, maxY = h/2;
    r = r.map(function (v) { return Math.max(0, Math.min(v, maxX, maxY)); });
    el.style.borderRadius = r.map(function(v){return v.toFixed(2)+"px";}).join(" ");
    el.style.setProperty("--shape-radius", r[0].toFixed(2)+"px");
    el.setAttribute("data-shape-resolved", mode);
  }
  function adopt(el) {
    if (info.has(el)) return;
    var base = radii(el);
    if (!base.some(Boolean) && !el.matches(CAPSULE)) return;
    var mode = shapeMode(el);
    info.set(el, { base: base, mode: mode });
    observed.add(el);
    if (ro) ro.observe(el);
    applyShape(el);
  }
  var ro = "ResizeObserver" in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (entry) { applyShape(entry.target); });
    entries.forEach(function (entry) {
      var parent = entry.target;
      observed.forEach(function (el) { if (el !== parent && parent.contains(el) && info.get(el).mode === "concentric") applyShape(el); });
    });
  }) : null;
  var queued = false;
  function scanShapes() {
    if (queued) return; queued = true;
    requestAnimationFrame(function () {
      queued = false;
      document.querySelectorAll(SEL).forEach(adopt);
      observed.forEach(function (el) { if (el.isConnected) applyShape(el); else { observed.delete(el); info.delete(el); if (ro) ro.unobserve(el); } });
    });
  }
  scanShapes();
  window.addEventListener("load", scanShapes);
  if (ro) window.addEventListener("resize", scanShapes, { passive: true });
  new MutationObserver(scanShapes).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-shape"] });
})();
