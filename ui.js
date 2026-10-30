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

  // Apple-inspired geometry engine: fixed, capsule, concentric
  var SEL = [".btn",".rsvp",".seg",".seg button",".tab",".tabbar",".card",".stat",".sm-select",".chip",".name-pill",".pay-btn",".poke-btn",".chk",
    ".search-form input",".week-stepper",".composer",".photo-btn",".sheet",".modal",".place-card",".set-group",".mem-list",".inv-list",".law-list",".search-results",".cal-day",".gate-card",
    ".card input:not([type=checkbox]):not([type=radio]):not([type=file])",".card select",".card textarea",".modal input",".modal select",".modal textarea",
    ".sheet input:not([type=checkbox]):not([type=radio]):not([type=file])",".sheet select",".sheet textarea",".gate-card input",".gate-card select"].join(",");
  var KEYS = ["TopLeft","TopRight","BottomRight","BottomLeft"], LONGHANDS = ["borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"];
  var info = new WeakMap(), observed = new Set(), CONTAINERS = ".card,.stat,.sheet,.modal,.place-card,.set-group,.mem-list,.inv-list,.law-list,.search-results,.gate-card,.cal-day";
  var CAPSULES = ".rsvp,.tab,.tabbar,.sm-select,.chip,.name-pill,.pay-btn,.poke-btn,.chk,.photo-btn";
  var nativeCurve = !!(window.CSS && CSS.supports && CSS.supports("corner-shape", "superellipse(3)"));
  var exponent = Math.max(2, Math.min(8, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--squircle")) || 3));
  function pair(value) {
    var a = String(value || "0").trim().split(/\s+/);
    return { x: Math.max(0, parseFloat(a[0]) || 0), y: Math.max(0, parseFloat(a[1] || a[0]) || 0) };
  }
  function readRadii(el) {
    var cs = getComputedStyle(el);
    return LONGHANDS.map(function (key) { return pair(cs[key]); });
  }
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  function clampRadii(r, w, h) {
    var out = r.map(function (v) { return { x: Math.max(0, Math.min(v.x, w / 2)), y: Math.max(0, Math.min(v.y, h / 2)) }; });
    var sums = [out[0].x + out[1].x, out[3].x + out[2].x, out[0].y + out[3].y, out[1].y + out[2].y];
    var limits = [w, w, h, h], scale = 1;
    sums.forEach(function (sum, i) { if (sum > 0) scale = Math.min(scale, limits[i] / sum); });
    if (scale < 1) out.forEach(function (v) { v.x *= scale; v.y *= scale; });
    return out;
  }
  function modeOf(el, base, rect) {
    var explicit = el.getAttribute("data-shape");
    if (explicit === "fixed" || explicit === "capsule" || explicit === "concentric") return explicit;
    if (el.matches(CAPSULES) || el.matches(".seg button,.week-stepper,.composer")) return "capsule";
    var min = Math.min(rect.w, rect.h);
    if (min && base.some(function (v) { return v.x >= min * .46 && v.y >= min * .30; })) return "capsule";
    return "fixed";
  }
  function shapeParent(el) {
    var p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      if (observed.has(p) && p.matches(CONTAINERS)) return p;
      p = p.parentElement;
    }
    return null;
  }
  function resolveRadii(el, data, rect) {
    var r = data.base.map(function (v) { return { x: v.x, y: v.y }; });
    if (data.mode === "capsule") {
      var radius = Math.min(rect.w, rect.h) / 2;
      r = r.map(function () { return { x: radius, y: radius }; });
    } else if (data.mode === "concentric") {
      var parent = shapeParent(el);
      if (parent) {
        var pd = info.get(parent), pr = rectOf(parent);
        var outer = pd && pd.resolved ? pd.resolved : readRadii(parent);
        var inset = [
          [rect.left - pr.left, rect.top - pr.top],
          [pr.right - rect.right, rect.top - pr.top],
          [pr.right - rect.right, pr.bottom - rect.bottom],
          [rect.left - pr.left, pr.bottom - rect.bottom]
        ];
        r = r.map(function (v, i) {
          var sharedX = Math.max(0, outer[i].x - Math.max(0, inset[i][0]));
          var sharedY = Math.max(0, outer[i].y - Math.max(0, inset[i][1]));
          return { x: v.x ? Math.min(v.x, sharedX) : sharedX, y: v.y ? Math.min(v.y, sharedY) : sharedY };
        });
      }
    }
    return clampRadii(r, rect.w, rect.h);
  }
  function squirclePath(w, h, r, n) {
    var steps = 12, pow = 2 / n, commands = [];
    function point(index, t) {
      var rx = r[index].x, ry = r[index].y, c = Math.pow(Math.max(0, Math.cos(t)), pow), s = Math.pow(Math.max(0, Math.sin(t)), pow);
      if (index === 0) return [rx - rx * (1 - c), ry - ry * (1 - s)];
      if (index === 1) return [w - rx + rx * s, ry - ry * (1 - c)];
      if (index === 2) return [w - rx + rx * (1 - c), h - ry + ry * s];
      return [rx - rx * s, h - ry + ry * (1 - c)];
    }
    function fmt(p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }
    function tangent(index, t, forward) {
      var eps = 0.0001, a = point(index, Math.max(0, t - (forward ? 0 : eps))), b = point(index, Math.min(Math.PI / 2, t + (forward ? eps : 0)));
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    }
    function arc(index) {
      var rx = r[index].x, ry = r[index].y;
      if (!rx || !ry) return;
      for (var j = 0; j < steps; j++) {
        var t0 = Math.PI / 2 * j / steps, t1 = Math.PI / 2 * (j + 1) / steps;
        var p0 = point(index, t0), p3 = point(index, t1), v0 = tangent(index, t0, true), v1 = tangent(index, t1, false);
        var d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 3;
        var p1 = [p0[0] + v0[0] * d, p0[1] + v0[1] * d], p2 = [p3[0] - v1[0] * d, p3[1] - v1[1] * d];
        commands.push("C" + fmt(p1) + " " + fmt(p2) + " " + fmt(p3));
      }
    }
    commands.push("M" + fmt([r[0].x, 0]));
    commands.push("L" + fmt([w - r[1].x, 0])); arc(1);
    commands.push("L" + fmt([w, h - r[2].y])); arc(2);
    commands.push("L" + fmt([r[3].x, h])); arc(3);
    commands.push("L" + fmt([0, r[0].y])); arc(0);
    commands.push("Z");
    return "path('" + commands.join(" ") + "')";
  }
  function splitShadows(value) {
    var out = [], start = 0, depth = 0;
    for (var i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      else if (value[i] === ")") depth--;
      else if (value[i] === "," && depth === 0) { out.push(value.slice(start, i).trim()); start = i + 1; }
    }
    if (value.slice(start).trim()) out.push(value.slice(start).trim());
    return out;
  }
  function shadowFilter(el, data) {
    if (data.shadowApplied) return;
    var cs = getComputedStyle(el), shadow = cs.boxShadow, originalFilter = cs.filter;
    data.shadowApplied = true;
    if (!shadow || shadow === "none") return;
    var filters = [];
    splitShadows(shadow).forEach(function (part) {
      if (/\binset\b/.test(part)) return;
      var colorMatch = part.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|transparent/);
      var lengths = part.replace(colorMatch ? colorMatch[0] : "", "").match(/-?(?:\d+\.?\d*|\.\d+)px/g) || [];
      if (lengths.length < 2) return;
      var x = lengths[0], y = lengths[1], blur = lengths[2] || "0px", spread = lengths[3] || "0px";
      var blurValue = Math.max(parseFloat(blur) || 0, parseFloat(spread) || 0);
      filters.push("drop-shadow(" + x + " " + y + " " + blurValue.toFixed(2) + "px " + (colorMatch ? colorMatch[0] : "rgba(0,0,0,.12)") + ")");
    });
    if (filters.length) el.style.filter = (originalFilter !== "none" ? originalFilter + " " : "") + filters.join(" ");
  }
  function applyShape(el) {
    var data = info.get(el);
    if (!data || !el.isConnected) return;
    var rect = rectOf(el);
    if (!rect.w || !rect.h) return;
    var r = resolveRadii(el, data, rect);
    data.resolved = r;
    if (nativeCurve) {
      LONGHANDS.forEach(function (key, i) { el.style[key] = r[i].x.toFixed(2) + "px " + r[i].y.toFixed(2) + "px"; });
      el.style.cornerShape = "superellipse(" + exponent + ")";
      el.style.clipPath = "";
    } else {
      shadowFilter(el, data);
      el.style.borderRadius = "0";
      el.style.clipPath = squirclePath(rect.w, rect.h, r, exponent);
    }
    el.setAttribute("data-shape-resolved", data.mode);
  }
  function adopt(el) {
    if (info.has(el)) return;
    var base = readRadii(el), rect = rectOf(el), mode = modeOf(el, base, rect);
    if (!base.some(function (v) { return v.x || v.y; }) && mode !== "capsule") return;
    var data = { base: base, mode: mode, resolved: null, shadowApplied: false };
    info.set(el, data);
    observed.add(el);
    if (ro) ro.observe(el);
    applyShape(el);
  }
  var queued = false;
  function scanShapes() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      document.querySelectorAll(SEL).forEach(adopt);
      observed.forEach(function (el) {
        if (!el.isConnected) {
          observed.delete(el); info.delete(el);
          if (ro) ro.unobserve(el);
        } else applyShape(el);
      });
    });
  }
  var ro = "ResizeObserver" in window ? new ResizeObserver(scanShapes) : null;
  scanShapes();
  window.addEventListener("load", scanShapes, { once: true });
  window.addEventListener("resize", scanShapes, { passive: true });
  new MutationObserver(scanShapes).observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "data-shape"]
  });
})();

