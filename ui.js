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
  // 실제 clip-path 다각형의 유클리드 내부 오프셋. 볼록 다각형의 안쪽 오프셋은
  // 각 변의 평행선 교점(마이터)이 정확한 거리 집합이며, 원호 조인은 바깥쪽 오프셋에 해당합니다.
  var tracked = new Set(), nestedChildren = new WeakMap(), nestedParent = new WeakMap(), CACHE_LIMIT = 96;
  var polygonCache = new Map(), offsetCache = new Map(), nestedCache = new Map();
  function memo(cache, key, build) {
    if (cache.has(key)) { var value = cache.get(key); cache.delete(key); cache.set(key, value); return value; }
    var value = build(); cache.set(key, value);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return value;
  }
  function shapeKey(w, h, r) { return w + '|' + h + '|' + r.map(function (v) { return Number(v).toFixed(4); }).join(','); }
  function polygonPoints(w, h, r) {
    var key = shapeKey(w, h, r);
    return memo(polygonCache, key, function () {
      var m = Math.min(w, h) / 2, e = r.map(function (v) { return Math.min(v, m); }), pts = [];
      var cx = [e[0], w - e[1], w - e[2], e[3]], cy = [e[0], e[1], h - e[2], h - e[3]];
      var corner = [[0, 0], [w, 0], [w, h], [0, h]];
      for (var k = 0; k < 4; k++) {
        if (!e[k]) { pts.push(corner[k]); continue; }
        for (var i = 0; i <= STEPS; i++) {
          var t = (Math.PI / 2) * i / STEPS, c = Math.pow(Math.cos(t), 2 / N), sn = Math.pow(Math.sin(t), 2 / N), x, y;
          if (k === 0) { x = cx[k] - e[k] * c; y = cy[k] - e[k] * sn; }
          else if (k === 1) { x = cx[k] + e[k] * sn; y = cy[k] - e[k] * c; }
          else if (k === 2) { x = cx[k] + e[k] * c; y = cy[k] + e[k] * sn; }
          else { x = cx[k] - e[k] * sn; y = cy[k] + e[k] * c; }
          pts.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
        }
      }
      return pts;
    });
  }
  function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
  function pointSegmentDistance(p, a, b) {
    var x = b[0] - a[0], y = b[1] - a[1], len2 = x * x + y * y;
    var t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / len2)) : 0;
    return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
  }
  function offsetPolygon(points, d, pointsKey) {
    var key = pointsKey + '|d=' + Number(d).toFixed(4);
    return memo(offsetCache, key, function () {
      var n = points.length, area = 0, edges = [], orientation;
      if (n < 3 || !(d > 0)) return null;
      for (var i = 0; i < n; i++) {
        var p = points[i], q = points[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
        if (len < 1e-7) return null;
        area += p[0] * q[1] - q[0] * p[1];
        edges.push({ x: dx, y: dy, px: p[0], py: p[1], nx: -dy / len, ny: dx / len });
      }
      if (Math.abs(area) < 1e-7) return null;
      orientation = area > 0 ? 1 : -1;
      edges.forEach(function (e, i) {
        if (orientation < 0) { e.nx = -e.nx; e.ny = -e.ny; }
        e.px = points[i][0] + e.nx * d; e.py = points[i][1] + e.ny * d;
      });
      var out = [];
      for (var j = 0; j < n; j++) {
        var prev = edges[(j + n - 1) % n], cur = edges[j], den = cross(prev.x, prev.y, cur.x, cur.y);
        if (Math.abs(den) < 1e-9) return null;
        var t = cross(cur.px - prev.px, cur.py - prev.py, cur.x, cur.y) / den;
        out.push([prev.px + t * prev.x, prev.py + t * prev.y]);
      }
      var outArea = 0;
      for (var k = 0; k < n; k++) {
        var a = out[k], b = out[(k + 1) % n], c = out[(k + 2) % n];
        outArea += a[0] * b[1] - b[0] * a[1];
        if (cross(b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]) * orientation < -1e-5) return null;
      }
      if (outArea * orientation <= 1e-7) return null;
      for (var v = 0; v < n; v++) for (var e = 0; e < n; e++) {
        var edge = edges[e], relx = out[v][0] - edge.px, rely = out[v][1] - edge.py;
        if (cross(edge.x, edge.y, relx, rely) * orientation < -0.025) return null;
      }
      // Euclidean corner check: every inset vertex and edge midpoint must remain d from the source boundary.
      // This validates the miter intersections as true inward-distance geometry, not as a visual join heuristic.
      for (var z = 0; z < n; z++) {
        var a0 = out[z], b0 = out[(z + 1) % n], samples = [a0, [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2]];
        for (var si = 0; si < samples.length; si++) {
          var nearest = Infinity;
          for (var sj = 0; sj < n; sj++) nearest = Math.min(nearest, pointSegmentDistance(samples[si], points[sj], points[(sj + 1) % n]));
          if (Math.abs(nearest - d) > 0.035) return null;
        }
      }
      return out;
    });
  }
  function rebuildNestedIndex() {
    nestedChildren = new WeakMap(); nestedParent = new WeakMap();
    tracked.forEach(function (el) {
      var p = el.parentElement;
      while (p && p !== document.body && !tracked.has(p)) p = p.parentElement;
      if (p && p !== document.body) {
        nestedParent.set(el, p);
        var children = nestedChildren.get(p);
        if (!children) { children = new Set(); nestedChildren.set(p, children); }
        children.add(el);
      }
    });
  }
  function paintTree(el, seen) {
    if (seen && seen.has(el)) return;
    if (seen) seen.add(el);
    paint(el);
    var children = nestedChildren.get(el);
    if (children) children.forEach(function (child) { paintTree(child, seen); });
  }
  function nestedSquircle(el) {
    var parent = el.parentElement;
    while (parent && parent !== document.body && !info.get(parent)) parent = parent.parentElement;
    if (!parent || parent === document.body) return null;
    var pi = info.get(parent); if (!pi || !pi.points || !pi.pointsKey) return null;
    var pr = parent.getBoundingClientRect(), cr = el.getBoundingClientRect(), pw = parent.offsetWidth, ph = parent.offsetHeight;
    var cw = el.offsetWidth, ch = el.offsetHeight, sx = pr.width / pw, sy = pr.height / ph;
    if (!pw || !ph || !cw || !ch || !sx || !sy) return null;
    var csx = cr.width / cw, csy = cr.height / ch;
    if (Math.abs(csx - sx) > .01 || Math.abs(csy - sy) > .01 || Math.abs(sx - sy) > .01) return null;
    var inset = { left: (cr.left - pr.left) / sx, top: (cr.top - pr.top) / sy, right: (pr.right - cr.right) / sx, bottom: (pr.bottom - cr.bottom) / sy };
    var d = (inset.left + inset.top + inset.right + inset.bottom) / 4;
    if (!(d > 0) || Math.max(Math.abs(inset.left - d), Math.abs(inset.top - d), Math.abs(inset.right - d), Math.abs(inset.bottom - d)) > .05) return null;
    var cacheKey = [pi.pointsKey, cw, ch, inset.left, inset.top, inset.right, inset.bottom, d].map(function (v) { return typeof v === 'number' ? v.toFixed(4) : v; }).join('|');
    return memo(nestedCache, cacheKey, function () {
      var shifted = offsetPolygon(pi.points, d, pi.pointsKey);
      if (!shifted) return null;
      var pts = shifted.map(function (p) { return [p[0] - inset.left, p[1] - inset.top]; });
      for (var j = 0; j < pts.length; j++) if (pts[j][0] < -.05 || pts[j][1] < -.05 || pts[j][0] > cw + .05 || pts[j][1] > ch + .05) return null;
      return { points: pts, key: 'O|' + cacheKey, path: "path('M" + pts.map(function (p) { return p[0].toFixed(4) + ' ' + p[1].toFixed(4); }).join('L') + "Z')" };
    });
  }
  function paint(el) {
    var i = info.get(el); if (!i) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) { el.style.clipPath = ''; i.points = null; i.pointsKey = ''; return; }
    var nested = nestedSquircle(el);
    if (nested) {
      el.style.clipPath = nested.path; i.points = nested.points; i.pointsKey = nested.key;
    } else {
      el.style.clipPath = squircle(w, h, i.r);
      i.points = polygonPoints(w, h, i.r); i.pointsKey = 'P|' + shapeKey(w, h, i.r);
    }
  }
  var CAN = !!(window.CSS && CSS.supports && CSS.supports("clip-path", "path('M0 0L1 0L1 1Z')"));
  var ro = CAN && "ResizeObserver" in window ? new ResizeObserver(function (es) { var seen = new Set(); es.forEach(function (e) { paintTree(e.target, seen); }); }) : null;
  function adopt(el) {
    if (info.has(el)) return;
    var cs = getComputedStyle(el), r = KEYS.map(function (k) { return parseFloat(cs["border" + k + "Radius"]) || 0; });
    if (!r.some(Boolean)) { info.set(el, null); return; }
    info.set(el, { r: r });
    tracked.add(el);
    el.style.borderRadius = "0";
    if (ro) ro.observe(el);
    paint(el);
  }
  var queued = false;
  function scanShapes() {
    if (queued) return; queued = true;
    requestAnimationFrame(function () {
      queued = false; document.querySelectorAll(SEL).forEach(adopt);
      tracked.forEach(function (el) { if (!el.isConnected) { tracked.delete(el); info.delete(el); if (ro) ro.unobserve(el); } });
      rebuildNestedIndex();
      var seen = new Set(); tracked.forEach(function (el) { if (!nestedParent.has(el)) paintTree(el, seen); });
    });
  }
  if (ro) { scanShapes(); window.addEventListener("load", scanShapes); new MutationObserver(scanShapes).observe(document.body, { childList: true, subtree: true }); }
})();
