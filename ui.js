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
