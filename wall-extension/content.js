(function () {
  "use strict";

  // injection/diagnostic marker (read by the self-test)
  try { window.__wallAutostart = { injected: true, clicks: 0, ticks: 0, url: location.href }; } catch (e) {}

  const CLICK_TEXT_PATTERNS = [
    /accept\s+(all\s+)?cookies/i,
    /accept\s+all/i,
    /allow\s+all/i,
    /agree/i,
    /watch\s+live/i
  ];

  const CLICKABLE_SELECTOR = [
    "button",
    "a",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']"
  ].join(",");

  const MEDIA_SELECTOR = "video, mux-player";

  function searchRoots() {
    const roots = [];
    const seen = new Set();

    function addRoot(root) {
      if (!root || seen.has(root)) {
        return;
      }

      seen.add(root);
      roots.push(root);

      if (typeof root.querySelectorAll !== "function") {
        return;
      }

      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) {
          addRoot(element.shadowRoot);
        }
      }
    }

    addRoot(document);
    return roots;
  }

  function visible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.pointerEvents !== "none"
    );
  }

  function labelFor(element) {
    if (element instanceof HTMLInputElement) {
      return element.value || element.getAttribute("aria-label") || "";
    }

    return [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title")
    ]
      .filter(Boolean)
      .join(" ");
  }

  function clickMatchingControls() {
    for (const root of searchRoots()) {
      for (const element of root.querySelectorAll(CLICKABLE_SELECTOR)) {
        if (!visible(element)) {
          continue;
        }

        const label = labelFor(element).replace(/\s+/g, " ").trim();
        if (!label) {
          continue;
        }

        if (CLICK_TEXT_PATTERNS.some((pattern) => pattern.test(label))) {
          element.click();
          try { if (window.__wallAutostart) window.__wallAutostart.clicks++; } catch (e) {}
        }
      }
    }
  }

  function playPausedMedia() {
    for (const root of searchRoots()) {
      for (const media of root.querySelectorAll(MEDIA_SELECTOR)) {
        if (media.paused === false || typeof media.play !== "function") {
          continue;
        }

        media.muted = true;
        media.defaultMuted = true;
        media.setAttribute("muted", "");
        media.playsInline = true;
        media.setAttribute("playsinline", "");

        const playPromise = media.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Retry loop handles players that are not ready yet.
          });
        }
      }
    }
  }

  function tick() {
    try { if (window.__wallAutostart) window.__wallAutostart.ticks++; } catch (e) {}
    clickMatchingControls();
    playPausedMedia();
  }

  const observer = new MutationObserver(tick);

  function start() {
    tick();
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
    window.setInterval(tick, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
