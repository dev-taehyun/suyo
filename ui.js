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

})();
