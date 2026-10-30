(function (root) {
  "use strict";
  var EPS = 1e-7, TAU = Math.PI / 2, DEFAULT_EXPONENT = 4, PATH_TOLERANCE = 0.045, MAX_DEPTH = 12, MAX_CHORD = 3.5;
  var CORNERS = ["tl", "tr", "br", "bl"], PROPS = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pair(rx, ry) { rx = Math.max(0, rx || 0); ry = Math.max(0, ry == null ? rx : ry); return rx <= EPS || ry <= EPS ? { rx: 0, ry: 0 } : { rx: rx, ry: ry }; }
  function parseLength(token, basis) {
    token = String(token || "0").trim();
    var n = parseFloat(token);
    if (!Number.isFinite(n)) return 0;
    return /%$/.test(token) ? basis * n / 100 : n;
  }
  function parseRadius(value, w, h) {
    var p = String(value || "0").trim().split(/\s+/);
    return pair(parseLength(p[0], w), parseLength(p[1] || p[0], h));
  }
  function normalizeRadii(r, w, h) {
    var a = r.map(function (v) { return pair(v.rx, v.ry); }), f = 1;
    function ratio(size, sum) { return sum > EPS ? size / sum : 1; }
    f = Math.min(f, ratio(w, a[0].rx + a[1].rx), ratio(w, a[3].rx + a[2].rx), ratio(h, a[0].ry + a[3].ry), ratio(h, a[1].ry + a[2].ry));
    if (f < 1) a.forEach(function (v) { v.rx *= f; v.ry *= f; });
    return a;
  }
  function resolveConcentric(parentRadii, offsets, childW, childH, parentScale, childScale, minimum, metric) {
    parentScale = parentScale || { x: 1, y: 1 }; childScale = childScale || { x: 1, y: 1 }; metric = metric || "center";
    var out = parentRadii.map(function (r, i) {
      var d = offsets[i] || { x: 0, y: 0 }, rx, ry;
      if (metric === "distance") {
        var distance = Math.hypot(d.x, d.y), screenRadiusX = r.rx * parentScale.x, screenRadiusY = r.ry * parentScale.y;
        var remainingX = Math.max(0, screenRadiusX - distance), remainingY = Math.max(0, screenRadiusY - distance);
        if (minimum > 0) { remainingX = Math.max(remainingX, minimum * childScale.x); remainingY = Math.max(remainingY, minimum * childScale.y); }
        rx = remainingX / childScale.x; ry = remainingY / childScale.y;
      } else {
        rx = (r.rx * parentScale.x - d.x) / childScale.x;
        ry = (r.ry * parentScale.y - d.y) / childScale.y;
        if (minimum > 0) { rx = Math.max(rx, minimum); ry = Math.max(ry, minimum); }
      }
      return pair(Math.max(0, rx), Math.max(0, ry));
    });
    return out;
  }
  function pointDistanceToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
    if (d < EPS) return Math.hypot(p.x - a.x, p.y - a.y);
    var t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / d, 0, 1);
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function superPoint(corner, t, w, h, r, exponent) {
    var p = 2 / exponent, s = Math.sin(t), c = Math.cos(t), sp = Math.pow(Math.max(0, s), p), cp = Math.pow(Math.max(0, c), p), rx = r.rx, ry = r.ry;
    if (corner === 0) return { x: rx - rx * cp, y: ry - ry * sp };
    if (corner === 1) return { x: w - rx + rx * sp, y: ry - ry * cp };
    if (corner === 2) return { x: w - rx + rx * cp, y: h - ry + ry * sp };
    return { x: rx - rx * sp, y: h - ry + ry * cp };
  }
  function sampleCorner(corner, w, h, r, exponent) {
    var start = superPoint(corner, 0, w, h, r, exponent), end = superPoint(corner, TAU, w, h, r, exponent), out = [start];
    function split(t0, p0, t1, p1, depth) {
      var span = t1 - t0, tm = (t0 + t1) / 2, tq1 = t0 + span * .25, tq3 = t0 + span * .75;
      var pm = superPoint(corner, tm, w, h, r, exponent), p1q = superPoint(corner, tq1, w, h, r, exponent), p3q = superPoint(corner, tq3, w, h, r, exponent);
      var err = Math.max(pointDistanceToSegment(pm, p0, p1), pointDistanceToSegment(p1q, p0, p1), pointDistanceToSegment(p3q, p0, p1));
      var chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (depth < MAX_DEPTH && (err > PATH_TOLERANCE || chord > MAX_CHORD)) {
        split(t0, p0, tm, pm, depth + 1); split(tm, pm, t1, p1, depth + 1);
      } else out.push(p1);
    }
    split(0, start, TAU, end, 0);
    return out;
  }
  function superellipsePath(w, h, radii, exponent) {
    w = Math.max(0, w); h = Math.max(0, h); exponent = clamp(Number(exponent) || DEFAULT_EXPONENT, 2, 8);
    var r = normalizeRadii(radii, w, h), pts = [], starts = [
      { x: r[0].rx, y: 0 }, { x: w - r[1].rx, y: 0 }, { x: w, y: h - r[2].ry }, { x: r[3].rx, y: h }
    ];
    pts.push(starts[0]); pts.push(starts[1]);
    for (var c = 1; c < 4; c++) {
      var radius = r[c];
      if (radius.rx <= EPS || radius.ry <= EPS) {
        var squareEnds = c === 1 ? { x: w, y: r[1].ry } : c === 2 ? { x: w - r[2].rx, y: h } : c === 3 ? { x: 0, y: h - r[3].ry } : { x: r[0].rx, y: 0 };
        pts.push(squareEnds); continue;
      }
      var arc = sampleCorner(c, w, h, radius, exponent);
      for (var j = 1; j < arc.length; j++) pts.push(arc[j]);
      if (c === 1) pts.push({ x: w, y: h - r[2].ry });
      if (c === 2) pts.push({ x: r[3].rx, y: h });
      if (c === 3) pts.push({ x: 0, y: r[0].ry });
    }
    if (r[0].rx > EPS && r[0].ry > EPS) {
      var last = sampleCorner(0, w, h, r[0], exponent);
      for (var k = 1; k < last.length - 1; k++) pts.push(last[k]);
    }
    function fmt(n) { return (Math.abs(n) < .0005 ? 0 : n).toFixed(3).replace(/\.000$/, ""); }
    var d = "M" + fmt(pts[0].x) + " " + fmt(pts[0].y);
    for (var q = 1; q < pts.length; q++) d += " L" + fmt(pts[q].x) + " " + fmt(pts[q].y);
    return d + " Z";
  }
  var CONTINUOUS_EXTENT = 1.528665;
  var CONTINUOUS_SEGMENTS = [
    { c1: [1.08849296, 0], c2: [0.86840694, 0], end: [0.63149379, 0.07491139] },
    { c1: [0.37282383, 0.16905956], c2: [0.16905956, 0.37282383], end: [0.07491139, 0.63149379] },
    { c1: [0, 0.86840694], c2: [0, 1.08849296], end: [0, 1.52866498] }
  ];
  function normalizeContinuousRadii(r, w, h) {
    var a = r.map(function (v) { return pair(v.rx, v.ry); }), f = 1, k = CONTINUOUS_EXTENT;
    function ratio(size, sum) { return sum > EPS ? size / (k * sum) : 1; }
    f = Math.min(f, ratio(w, a[0].rx + a[1].rx), ratio(w, a[3].rx + a[2].rx), ratio(h, a[0].ry + a[3].ry), ratio(h, a[1].ry + a[2].ry));
    if (f < 1) a.forEach(function (v) { v.rx *= f; v.ry *= f; });
    return a;
  }
  function continuousPoint(corner, p, w, h, r) {
    var u = p[0], v = p[1];
    if (corner === "tr") return { x: w - u * r.rx, y: v * r.ry };
    if (corner === "br") return { x: w - v * r.rx, y: h - u * r.ry };
    if (corner === "bl") return { x: u * r.rx, y: h - v * r.ry };
    return { x: v * r.rx, y: u * r.ry };
  }
  function continuousPath(w, h, radii) {
    var r = normalizeContinuousRadii(radii, w, h), fmt = function (n) { return (Math.abs(n) < .00005 ? 0 : n).toFixed(4).replace(/\.0000$/, ""); };
    function pt(p) { return fmt(p.x) + " " + fmt(p.y); }
    function cornerPath(name, radius) {
      if (radius.rx <= EPS || radius.ry <= EPS) return "";
      var d = "";
      CONTINUOUS_SEGMENTS.forEach(function (s) {
        d += " C " + pt(continuousPoint(name, s.c1, w, h, radius)) + " " + pt(continuousPoint(name, s.c2, w, h, radius)) + " " + pt(continuousPoint(name, s.end, w, h, radius));
      });
      return d;
    }
    var d = "M " + fmt(CONTINUOUS_EXTENT * r[0].rx) + " 0 L " + fmt(w - CONTINUOUS_EXTENT * r[1].rx) + " 0";
    d += cornerPath("tr", r[1]);
    d += " L " + fmt(w) + " " + fmt(h - CONTINUOUS_EXTENT * r[2].ry);
    d += cornerPath("br", r[2]);
    d += " L " + fmt(CONTINUOUS_EXTENT * r[3].rx) + " " + fmt(h);
    d += cornerPath("bl", r[3]);
    d += " L 0 " + fmt(CONTINUOUS_EXTENT * r[0].ry);
    d += cornerPath("tl", r[0]) + " Z";
    return d;
  }
  function capsulePath(w, h) {
    var r = Math.min(w, h) / 2, f = function (n) { return (Math.abs(n) < .00005 ? 0 : n).toFixed(4).replace(/\.0000$/, ""); };
    if (r <= EPS) return "M 0 0 L " + f(w) + " 0 L " + f(w) + " " + f(h) + " L 0 " + f(h) + " Z";
    return "M " + f(r) + " 0 L " + f(w - r) + " 0 A " + f(r) + " " + f(r) + " 0 0 1 " + f(w) + " " + f(r) + " L " + f(w) + " " + f(h - r) + " A " + f(r) + " " + f(r) + " 0 0 1 " + f(w - r) + " " + f(h) + " L " + f(r) + " " + f(h) + " A " + f(r) + " " + f(r) + " 0 0 1 0 " + f(h - r) + " L 0 " + f(r) + " A " + f(r) + " " + f(r) + " 0 0 1 " + f(r) + " 0 Z";
  }
  var MathAPI = { parseRadius: parseRadius, normalizeRadii: normalizeRadii, normalizeContinuousRadii: normalizeContinuousRadii, resolveConcentric: resolveConcentric, superellipsePath: superellipsePath, continuousPath: continuousPath, capsulePath: capsulePath };
  root.SuyoShapeGeometry = MathAPI;
  if (!root.document || !root.getComputedStyle) return;

  var doc = root.document, states = new WeakMap(), nodes = new Set(), pathCache = new Map(), nextId = 1, raf = 0, resizeObserver = null, mutationObserver = null, defs = null, destroyed = false;
  var FIXED = ".card,.sheet,.modal,.places-sheet,.search-results,.place-card,.stat,.set-group,.mem-list,.inv-list,.law-list,.cal-day,.sheet-head.profile,.gate-msg.error";
  var CAPSULE = ".btn,.rsvp,.seg,.tab,.tabbar,.sm-select,.chip,.name-pill,.pay-btn,.poke-btn,.chk,.search-form input,.week-stepper,.composer,.photo-btn,.icon-btn,.toast,.card input:not([type=checkbox]):not([type=radio]):not([type=file]),.card select,.card textarea,.sheet input:not([type=checkbox]):not([type=radio]):not([type=file]),.sheet select,.sheet textarea,.modal input:not([type=checkbox]):not([type=radio]):not([type=file]),.modal select,.modal textarea,.gate-card input:not([type=checkbox]):not([type=radio]):not([type=file]),.gate-card select";
  var CONTAINERS = ".card,.sheet,.modal,.places-sheet,.tabbar,.set-group,.mem-list,.inv-list,.law-list,.search-results,.cal-day";
  var SHAPE_SELECTOR = [FIXED, CAPSULE, "[data-shape]"].join(",");
  var CLIP_CHILDREN = ".sheet,.set-group,.mem-list,.inv-list,.law-list";
  var cssText = [
    '[data-suyo-shape-layer="before"],[data-suyo-shape-layer="after"]{isolation:isolate}',
    '[data-suyo-shape-layer="before"]{background-color:transparent!important;background-image:none!important;border-color:transparent!important}',
    '[data-suyo-shape-layer="after"]{background-color:transparent!important;background-image:none!important;border-color:transparent!important}',
    '[data-suyo-shape-clip]{clip-path:var(--suyo-shape-clip)!important;-webkit-clip-path:var(--suyo-shape-clip)!important;border-radius:0!important}',
    '[data-suyo-shape-layer="before"]::before,[data-suyo-shape-layer="after"]::after{content:"";position:absolute;left:calc(-1 * var(--suyo-shape-bl-width,0px));top:calc(-1 * var(--suyo-shape-bt-width,0px));right:calc(-1 * var(--suyo-shape-br-width,0px));bottom:calc(-1 * var(--suyo-shape-bb-width,0px));z-index:-1;display:block;box-sizing:border-box;pointer-events:none;border-radius:0;clip-path:var(--suyo-shape-clip);-webkit-clip-path:var(--suyo-shape-clip);background-color:var(--suyo-shape-bg-color,transparent);background-image:var(--suyo-shape-bg-image,none);background-position:var(--suyo-shape-bg-position,0% 0%);background-size:var(--suyo-shape-bg-size,auto);background-repeat:var(--suyo-shape-bg-repeat,repeat);background-origin:var(--suyo-shape-bg-origin,padding-box);background-clip:var(--suyo-shape-bg-clip,border-box);background-attachment:var(--suyo-shape-bg-attachment,scroll);background-blend-mode:var(--suyo-shape-bg-blend,normal);border-top:var(--suyo-shape-bt-width,0) var(--suyo-shape-bt-style,none) var(--suyo-shape-bt-color,transparent);border-right:var(--suyo-shape-br-width,0) var(--suyo-shape-br-style,none) var(--suyo-shape-br-color,transparent);border-bottom:var(--suyo-shape-bb-width,0) var(--suyo-shape-bb-style,none) var(--suyo-shape-bb-color,transparent);border-left:var(--suyo-shape-bl-width,0) var(--suyo-shape-bl-style,none) var(--suyo-shape-bl-color,transparent);transition:var(--suyo-shape-transition,none)}'
  ].join("\n");
  var styleNode = doc.createElement("style"); styleNode.setAttribute("data-suyo-shape-style", ""); styleNode.textContent = cssText; (doc.head || doc.documentElement).appendChild(styleNode);
  var pathMode = root.CSS && root.CSS.supports && root.CSS.supports("clip-path", "path('M 0 0 C 0 0 1 1 1 1 A 1 1 0 0 1 2 2 Z')") ? "css" : "svg";
  if (pathMode === "svg") {
    try {
      var test = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      pathMode = root.CSS && root.CSS.supports && root.CSS.supports("clip-path", "url(#suyo-test)") ? "svg" : "none";
      if (!test) pathMode = "none";
    } catch (_) { pathMode = "none"; }
  }
  function ensureDefs() {
    if (defs || pathMode !== "svg") return;
    var svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    var d = doc.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.appendChild(d); (doc.body || doc.documentElement).appendChild(svg); defs = d;
  }
  function metrics(el) {
    var rect = el.getBoundingClientRect(), cs = root.getComputedStyle(el), w = parseFloat(cs.width), h = parseFloat(cs.height), cssWidth = Number.isFinite(w), cssHeight = Number.isFinite(h);
    if (!cssWidth) w = el.offsetWidth || rect.width || 0;
    if (!cssHeight) h = el.offsetHeight || rect.height || 0;
    if (cs.boxSizing !== "border-box") {
      if (cssWidth) w += parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      if (cssHeight) h += parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    }
    return { rect: rect, w: w, h: h, sx: w ? rect.width / w : 1, sy: h ? rect.height / h : 1 };
  }
  function readRadii(el, cs, m) {
    return PROPS.map(function (p) { return parseRadius(cs[p], m.w, m.h); });
  }
  function capturePaint(cs) {
    var paint = { "--suyo-shape-bg-color": cs.backgroundColor, "--suyo-shape-bg-image": cs.backgroundImage, "--suyo-shape-bg-position": cs.backgroundPosition, "--suyo-shape-bg-size": cs.backgroundSize, "--suyo-shape-bg-repeat": cs.backgroundRepeat, "--suyo-shape-bg-origin": cs.backgroundOrigin, "--suyo-shape-bg-clip": cs.backgroundClip, "--suyo-shape-bg-attachment": cs.backgroundAttachment, "--suyo-shape-bg-blend": cs.backgroundBlendMode, "--suyo-shape-transition": cs.transition };
    var sides = ["Top", "Right", "Bottom", "Left"], short = ["bt", "br", "bb", "bl"];
    sides.forEach(function (side, i) { paint["--suyo-shape-" + short[i] + "-width"] = cs["border" + side + "Width"]; paint["--suyo-shape-" + short[i] + "-style"] = cs["border" + side + "Style"]; paint["--suyo-shape-" + short[i] + "-color"] = cs["border" + side + "Color"]; });
    return paint;
  }
  function applyPaint(el, paint) { Object.keys(paint).forEach(function (key) { el.style.setProperty(key, paint[key]); }); }
  function readPaint(el) {
    var layer = el.getAttribute("data-suyo-shape-layer"), clip = el.hasAttribute("data-suyo-shape-clip");
    el.removeAttribute("data-suyo-shape-layer"); el.removeAttribute("data-suyo-shape-clip");
    var paint = capturePaint(root.getComputedStyle(el));
    if (layer) el.setAttribute("data-suyo-shape-layer", layer);
    if (clip) el.setAttribute("data-suyo-shape-clip", "");
    return paint;
  }
  function readNativeStyle(el, m, needPaint) {
    var layer = el.getAttribute("data-suyo-shape-layer"), clip = el.hasAttribute("data-suyo-shape-clip");
    el.removeAttribute("data-suyo-shape-layer"); el.removeAttribute("data-suyo-shape-clip");
    var cs = root.getComputedStyle(el), own = readRadii(el, cs, m), position = cs.position, exponent = cs.getPropertyValue("--suyo-shape-exponent"), transform = cs.transform, paint = needPaint ? capturePaint(cs) : null;
    if (layer) el.setAttribute("data-suyo-shape-layer", layer);
    if (clip) el.setAttribute("data-suyo-shape-clip", "");
    return { radii: own, position: position, exponent: exponent, transform: transform, paint: paint };
  }
  function isZero(r) { return !r.some(function (v) { return v.rx > EPS && v.ry > EPS; }); }
  function parseCornerMap(value) {
    var out = {};
    String(value || "").split(/[;,]/).forEach(function (part) {
      var m = part.trim().match(/^(tl|tr|br|bl)\s*:\s*(fixed|concentric|square|capsule)$/i);
      if (m) out[m[1].toLowerCase()] = m[2].toLowerCase();
    });
    return out;
  }
  function resolveMode(el, own) {
    var explicit = (el.getAttribute("data-shape") || "").toLowerCase();
    if (explicit === "fixed" || explicit === "capsule" || explicit === "concentric") return explicit;
    if (el.matches(".group-head .btn.sm")) return "fixed";
    if (el.matches(".set-group,.mem-list,.inv-list,.stat,.cal-day") && el.closest(".sheet")) return "concentric";
    if (el.matches(CAPSULE) && !isZero(own)) return "capsule";
    if (el.matches(FIXED)) return "fixed";
    return null;
  }
  function findContainer(el) {
    var p = el.parentElement;
    while (p) {
      if (p.hasAttribute("data-shape-container") || p.matches(CONTAINERS)) return p;
      if (p === doc.documentElement) break;
      p = p.parentElement;
    }
    return null;
  }
  function isAxisAligned(transform) {
    if (!transform || transform === "none") return true;
    try {
      if (root.DOMMatrixReadOnly) { var m = new root.DOMMatrixReadOnly(transform); return m.is2D && Math.abs(m.b) < 1e-5 && Math.abs(m.c) < 1e-5; }
      var a = transform.match(/^matrix\(([^)]+)\)$/); if (!a) return false;
      var v = a[1].split(",").map(Number); return v.length === 6 && Math.abs(v[1]) < 1e-5 && Math.abs(v[2]) < 1e-5;
    } catch (_) { return false; }
  }
  function getParentRadii(parent) {
    var state = states.get(parent);
    if (state && state.active && state.resolved) return state.resolved;
    var m = metrics(parent), native = readNativeStyle(parent, m), own = native.radii;
    if (parent.matches(CAPSULE) || parent.getAttribute("data-shape") === "capsule") {
      var rad = Math.min(m.w, m.h) / 2;
      return [pair(rad, rad), pair(rad, rad), pair(rad, rad), pair(rad, rad)];
    }
    return parent.getAttribute("data-shape-curve") === "superellipse" ? normalizeRadii(own, m.w, m.h) : normalizeContinuousRadii(own, m.w, m.h);
  }
  function cornerOffsets(parentM, childM) {
    var a = parentM.rect, b = childM.rect;
    return [
      { x: b.left - a.left, y: b.top - a.top },
      { x: a.right - b.right, y: b.top - a.top },
      { x: a.right - b.right, y: a.bottom - b.bottom },
      { x: b.left - a.left, y: a.bottom - b.bottom }
    ];
  }
  function resolveRadii(el, mode, own, m, parent, cornerMap) {
    var out = own.map(function (v) { return pair(v.rx, v.ry); }), parentR = null, offsets = null, pm = null;
    if (mode === "capsule") {
      var r = Math.min(m.w, m.h) / 2;
      out = [pair(r, r), pair(r, r), pair(r, r), pair(r, r)];
    }
    var needsConcentric = mode === "concentric" || Object.keys(cornerMap).some(function (k) { return cornerMap[k] === "concentric"; });
    if (parent && needsConcentric) {
      pm = metrics(parent); parentR = getParentRadii(parent); offsets = cornerOffsets(pm, m);
      var min = Math.max(0, parseFloat(el.getAttribute("data-shape-min-radius")) || 0), metric = el.getAttribute("data-shape-concentric-mode") === "distance" ? "distance" : "center";
      var con = resolveConcentric(parentR, offsets, m.w, m.h, { x: pm.sx || 1, y: pm.sy || 1 }, { x: m.sx || 1, y: m.sy || 1 }, min, metric);
      for (var i = 0; i < 4; i++) {
        var kind = cornerMap[CORNERS[i]] || mode;
        if (kind === "concentric") out[i] = con[i];
        else if (kind === "square") out[i] = pair(0, 0);
        else if (kind === "capsule") { var cr = Math.min(m.w, m.h) / 2; out[i] = pair(cr, cr); }
        else if (kind === "fixed") out[i] = own[i];
      }
    } else {
      for (var j = 0; j < 4; j++) {
        var style = cornerMap[CORNERS[j]];
        if (style === "square") out[j] = pair(0, 0);
        else if (style === "fixed") out[j] = own[j];
        else if (style === "capsule") { var rr = Math.min(m.w, m.h) / 2; out[j] = pair(rr, rr); }
      }
    }
    return { radii: out, parentMetrics: pm, offsets: offsets, parentRadii: parentR };
  }
  function chooseLayer(el) {
    if (el.matches(".sheet,.places-sheet")) return "after";
    return "before";
  }
  function syncPaint(el, state, paint) {
    if (!paint) paint = readPaint(el);
    state.paint = paint; applyPaint(el, paint);
    if (state.layer) el.setAttribute("data-suyo-shape-layer", state.layer);
    if (state.clipChildren) el.setAttribute("data-suyo-shape-clip", "");
  }
  function pathFor(el, m, radii, curve, exponent, state) {
    var key = [curve, m.w.toFixed(3), m.h.toFixed(3), exponent.toFixed(3), radii.map(function (r) { return r.rx.toFixed(3) + "," + r.ry.toFixed(3); }).join(";")].join("|");
    if (pathCache.has(key)) return pathCache.get(key);
    var d = curve === "capsule" ? MathAPI.capsulePath(m.w, m.h) : curve === "superellipse" ? MathAPI.superellipsePath(m.w, m.h, radii, exponent) : MathAPI.continuousPath(m.w, m.h, radii), clip;
    if (pathMode === "css") clip = "path('" + d + "')";
    else if (pathMode === "svg") {
      ensureDefs();
      if (!state.clipId) {
        state.clipId = "suyo-shape-" + nextId++;
        var cp = doc.createElementNS("http://www.w3.org/2000/svg", "clipPath"), p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        cp.setAttribute("id", state.clipId); cp.setAttribute("clipPathUnits", "userSpaceOnUse"); cp.appendChild(p); defs.appendChild(cp); state.clipPath = p;
      }
      state.clipPath.setAttribute("d", d); clip = "url(#" + state.clipId + ")";
    } else clip = "";
    var result = { d: d, clip: clip };
    pathCache.set(key, result); if (pathCache.size > 420) pathCache.delete(pathCache.keys().next().value);
    return result;
  }
  function shouldClipChildren(el) {
    if (el.hasAttribute("data-shape-clip-children")) return el.getAttribute("data-shape-clip-children") !== "false";
    return el.matches(CLIP_CHILDREN);
  }
  function update(el, forcePaint) {
    if (destroyed || !el || !el.isConnected) return;
    if (resizeObserver && !states.has(el)) resizeObserver.observe(el);
    var m = metrics(el); if (m.w <= 0 || m.h <= 0) return;
    var state = states.get(el), native = readNativeStyle(el, m, !state || forcePaint), own = native.radii, mode = resolveMode(el, own);
    if (!mode) return;
    var explicit = !!el.getAttribute("data-shape"), parent = findContainer(el);
    var cornerMap = parseCornerMap(el.getAttribute("data-shape-corners"));
    if (!explicit && mode === "fixed" && isZero(own)) return;
    var requestedMode = mode, needsConcentric = mode === "concentric" || Object.keys(cornerMap).some(function (k) { return cornerMap[k] === "concentric"; });
    var unsupportedTransform = !!(parent && needsConcentric && (!isAxisAligned(native.transform) || !isAxisAligned(root.getComputedStyle(parent).transform)));
    if (unsupportedTransform) parent = null;
    if (mode === "concentric" && !parent) mode = "fixed";
    var curve = el.getAttribute("data-shape-curve") || (mode === "capsule" ? "capsule" : "continuous");
    if (["continuous", "capsule", "superellipse"].indexOf(curve) < 0) curve = mode === "capsule" ? "capsule" : "continuous";
    var result = resolveRadii(el, mode, own, m, parent, cornerMap);
    var resolved = curve === "continuous" ? normalizeContinuousRadii(result.radii, m.w, m.h) : normalizeRadii(result.radii, m.w, m.h);
    result.radii = resolved;
    var exponent = curve === "capsule" ? 2 : clamp(parseFloat(el.getAttribute("data-shape-exponent")) || parseFloat(native.exponent) || parseFloat(root.getComputedStyle(doc.documentElement).getPropertyValue("--suyo-shape-exponent")) || DEFAULT_EXPONENT, 2, 8);
    if (!state) {
      state = { layer: chooseLayer(el), clipChildren: shouldClipChildren(el), originalPosition: el.style.position, addedPosition: false, active: true, clipId: null, clipPath: null };
      states.set(el, state); nodes.add(el);
      if (native.position === "static") { el.style.position = "relative"; state.addedPosition = true; }
      ["pointerenter", "pointerleave", "pointerdown", "pointerup", "focusin", "focusout", "change", "transitionend"].forEach(function (eventName) {
        el.addEventListener(eventName, function () { var s = states.get(el); if (s && s.active && !destroyed) { syncPaint(el, s); s.lastStyle = el.getAttribute("style"); } }, { passive: true });
      });
    } else if (!state.active) {
      state.active = true; nodes.add(el);
      if (native.position === "static" && !state.addedPosition) { state.originalPosition = el.style.position; el.style.position = "relative"; state.addedPosition = true; }
      if (resizeObserver) resizeObserver.observe(el);
    }
    var geometryKey = [mode, curve, el.getAttribute("data-shape-concentric-mode") || "center", m.w.toFixed(3), m.h.toFixed(3), m.sx.toFixed(4), m.sy.toFixed(4), exponent.toFixed(3), resolved.map(function (r) { return r.rx.toFixed(3) + "," + r.ry.toFixed(3); }).join(";"), (result.offsets || []).map(function (d) { return d.x.toFixed(2) + "," + d.y.toFixed(2); }).join(";")].join("|");
    if (!forcePaint && state.geometryKey === geometryKey) return;
    state.mode = mode; state.requestedMode = requestedMode; state.unsupportedTransform = unsupportedTransform; state.axisAligned = isAxisAligned(native.transform); state.resolved = resolved; state.base = own; state.metrics = m; state.parent = parent; state.offsets = result.offsets; state.geometryKey = geometryKey;
    var path = pathFor(el, m, resolved, curve, exponent, state);
    if (!path.clip) return;
    el.style.setProperty("--suyo-shape-clip", path.clip);
    if (state.clipChildren) el.setAttribute("data-suyo-shape-clip", "");
    else el.removeAttribute("data-suyo-shape-clip");
    el.setAttribute("data-suyo-shape-mode", mode);
    el.setAttribute("data-suyo-shape-exponent", String(exponent));
    syncPaint(el, state, native.paint || state.paint);
    state.path = path.d; state.clip = path.clip; state.curve = curve; state.concentricMetric = el.getAttribute("data-shape-concentric-mode") === "distance" ? "distance" : "center"; state.centerResidual = centerResidual(result, m, parent); state.lastStyle = el.getAttribute("style");
  }
  function centerResidual(result, childM, parent) {
    if (!parent || !result.parentRadii || !result.offsets) return null;
    var pm = result.parentMetrics, out = [];
    for (var i = 0; i < 4; i++) {
      var pr = result.parentRadii[i], cr = result.radii[i], d = result.offsets[i];
      if (pr.rx <= EPS || pr.ry <= EPS || cr.rx <= EPS || cr.ry <= EPS) { out.push({ x: 0, y: 0, error: 0 }); continue; }
      var px = (pr.rx * pm.sx - d.x) - cr.rx * childM.sx;
      var py = (pr.ry * pm.sy - d.y) - cr.ry * childM.sy;
      out.push({ x: px, y: py, error: Math.hypot(px, py) });
    }
    return out;
  }
  function collect(rootNode) {
    var out = [];
    if (rootNode && rootNode.nodeType === 1 && (rootNode.matches(SHAPE_SELECTOR))) out.push(rootNode);
    var base = rootNode && rootNode.querySelectorAll ? rootNode : doc;
    base.querySelectorAll(SHAPE_SELECTOR).forEach(function (el) { out.push(el); });
    return out;
  }
  function release(el) {
    var s = states.get(el); if (!s || !s.active) return;
    s.active = false; el.removeAttribute("data-suyo-shape-layer"); el.removeAttribute("data-suyo-shape-clip"); el.removeAttribute("data-suyo-shape-mode"); el.removeAttribute("data-suyo-shape-exponent");
    ["--suyo-shape-clip", "--suyo-shape-bg-color", "--suyo-shape-bg-image", "--suyo-shape-bg-position", "--suyo-shape-bg-size", "--suyo-shape-bg-repeat", "--suyo-shape-bg-origin", "--suyo-shape-bg-clip", "--suyo-shape-bg-attachment", "--suyo-shape-bg-blend", "--suyo-shape-transition", "--suyo-shape-bt-width", "--suyo-shape-bt-style", "--suyo-shape-bt-color", "--suyo-shape-br-width", "--suyo-shape-br-style", "--suyo-shape-br-color", "--suyo-shape-bb-width", "--suyo-shape-bb-style", "--suyo-shape-bb-color", "--suyo-shape-bl-width", "--suyo-shape-bl-style", "--suyo-shape-bl-color"].forEach(function (p) { el.style.removeProperty(p); });
    if (s.addedPosition && el.style.position === "relative") el.style.position = s.originalPosition;
    s.lastStyle = el.getAttribute("style"); nodes.delete(el); if (resizeObserver) resizeObserver.unobserve(el);
  }
  function refresh(rootNode) {
    if (destroyed || raf) return;
    raf = root.requestAnimationFrame(function () {
      raf = 0;
      var list = collect(doc), active = new Set(list);
      list.sort(function (a, b) { if (a === b) return 0; var p = a.compareDocumentPosition(b); return p & 4 ? -1 : 1; });
      list.forEach(function (el) { update(el, true); });
      Array.from(nodes).forEach(function (el) { if (!el.isConnected || !active.has(el)) release(el); });
    });
  }
  function refreshConcentric() {
    if (destroyed || raf) return;
    raf = root.requestAnimationFrame(function () { raf = 0; nodes.forEach(function (el) { var s = states.get(el); if (s && s.active && s.parent && s.offsets) update(el, false); }); });
  }
  function inspect(el) {
    var s = states.get(el); if (!s || !s.active) return null;
    var lines = (s.path.match(/ L/g) || []).length, curves = (s.path.match(/ C/g) || []).length, arcs = (s.path.match(/ A/g) || []).length;
    return { mode: s.mode, requestedMode: s.requestedMode, curve: s.curve, concentricMetric: s.concentricMetric, unsupportedTransform: !!s.unsupportedTransform, width: s.metrics.w, height: s.metrics.h, exponent: Number(el.getAttribute("data-suyo-shape-exponent")), baseRadii: s.base, resolvedRadii: s.resolved, parent: s.parent, offsets: s.offsets, centerResidual: s.centerResidual, pathSegments: lines + curves + arcs, pathCommands: { lines: lines, cubics: curves, arcs: arcs }, renderer: pathMode };
  }
  function audit(rootNode) {
    var list = collect(rootNode || doc), report = { total: list.length, processed: 0, unprocessed: 0, missingParent: [], unsupportedTransforms: [], invalidRadius: [], centerErrors: [], metricDrift: [], renderer: pathMode };
    list.forEach(function (el) {
      var s = states.get(el); if (!s || !s.active) { if (el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0) report.unprocessed++; return; }
      report.processed++;
      if (s.unsupportedTransform) report.unsupportedTransforms.push(el);
      else if ((s.requestedMode === "concentric" || /(?:^|[,;])\s*(?:tl|tr|br|bl)\s*:\s*concentric/i.test(el.getAttribute("data-shape-corners") || "")) && !s.parent) report.missingParent.push(el);
      if (s.resolved.some(function (r) { return !Number.isFinite(r.rx) || !Number.isFinite(r.ry) || r.rx < 0 || r.ry < 0; })) report.invalidRadius.push(el);
      if (s.centerResidual) s.centerResidual.forEach(function (v, i) { if (v.error > .15) { if (s.concentricMetric === "distance") report.metricDrift.push({ element: el, corner: CORNERS[i], error: v.error }); else report.centerErrors.push({ element: el, corner: CORNERS[i], error: v.error }); } });
    });
    report.pass = !report.unprocessed && !report.missingParent.length && !report.unsupportedTransforms.length && !report.invalidRadius.length && !report.centerErrors.length;
    return report;
  }
  function setMode(el, mode, options) {
    if (!el || !/^(fixed|capsule|concentric)$/.test(mode)) return false;
    el.setAttribute("data-shape", mode);
    if (options && options.minimum != null) el.setAttribute("data-shape-min-radius", String(options.minimum));
    if (options && options.corners) el.setAttribute("data-shape-corners", options.corners);
    refresh(el); return true;
  }
  function destroy() {
    destroyed = true; if (mutationObserver) mutationObserver.disconnect(); if (resizeObserver) resizeObserver.disconnect();
    Array.from(nodes).forEach(release); nodes.clear(); styleNode.remove();
    if (defs && defs.parentNode) defs.parentNode.remove();
  }
  var api = { version: "6.0.0", refresh: refresh, inspect: inspect, audit: audit, setMode: setMode, destroy: destroy, geometry: MathAPI };
  root.SuyoShapeEngine = api;
  if (pathMode === "none") { styleNode.remove(); root.console && root.console.warn("SuyoShapeEngine: no path clipping backend; native border radii retained."); return; }
  if ("ResizeObserver" in root) resizeObserver = new ResizeObserver(function () { refresh(); });
  refresh();
  if ("MutationObserver" in root && doc.documentElement) {
    mutationObserver = new MutationObserver(function (records) {
      var changed = records.some(function (r) {
        if (r.type === "childList") return true;
        if (r.attributeName === "style") { if (r.target === doc.documentElement) return false; var st = states.get(r.target); return !st || r.target.getAttribute("style") !== st.lastStyle; }
        return ["class", "data-theme", "data-shape", "data-shape-container", "data-shape-corners", "data-shape-min-radius", "data-shape-exponent", "data-shape-curve", "data-shape-concentric-mode", "hidden", "disabled", "aria-pressed", "aria-selected"].indexOf(r.attributeName) >= 0;
      });
      if (changed) refresh();
    });
    mutationObserver.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-theme", "data-shape", "data-shape-container", "data-shape-corners", "data-shape-min-radius", "data-shape-exponent", "data-shape-curve", "data-shape-concentric-mode", "hidden", "disabled", "aria-pressed", "aria-selected"] });
  }
  var colorScheme = root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)");
  if (colorScheme) { if (colorScheme.addEventListener) colorScheme.addEventListener("change", refresh); else if (colorScheme.addListener) colorScheme.addListener(refresh); }
  root.addEventListener("resize", refresh, { passive: true });
  root.addEventListener("orientationchange", refresh, { passive: true });
  root.addEventListener("scroll", refreshConcentric, { passive: true });
  root.addEventListener("load", refresh, { once: true });
})(typeof window !== "undefined" ? window : globalThis);
