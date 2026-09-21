(() => {
  "use strict";
  document.querySelectorAll("[data-worldcore-gallery]").forEach(initGallery);
  function initGallery(gallery) {
  const examples = [...gallery.querySelectorAll("[data-demo]")].map(button => ({
    ...window.WORLDCRAFTER_DEMOS[button.dataset.demo],
  }));
  const output = gallery.querySelector("[data-demo-output]");
  const reconstruction = gallery.querySelector("[data-demo-reconstruction]");
  const strip = gallery.querySelector(".thumb-strip");
  const rail = gallery.querySelector(".thumb-rail");
  const buttons = [...strip.querySelectorAll("[data-demo]")];
  gallery.querySelector(".input-output").after(rail);
  rail.style.setProperty("--preview-columns", ["generation", "text-generation"].includes(gallery.dataset.worldcoreGallery)
    ? 5 : Math.max(1, Math.ceil(buttons.length / 2)));
  const status = gallery.querySelector(".gallery-status");
  const queryKey = gallery.dataset.demoParam || "demo";
  const params = new URLSearchParams(location.search);
  const requested = params.get(queryKey) || params.get("demo");
  let selected = examples.find(e => e.id === requested) || examples[0];
  let epoch = 0, internalPauses = 0;
  let wantsPlayback = true, visible = false, starting = false;
  let lastCorrection = 0;
  const paired = () => !!selected.reconstruction;
  const videos = () => paired() ? [output, reconstruction] : [output];
  function loadMedia() {
    videos().forEach(video => {
      if (!video.dataset.pendingSrc) return;
      video.preload = "auto";
      video.src = video.dataset.pendingSrc;
      delete video.dataset.pendingSrc;
      video.load();
    });
  }
  const report = (message = "") => { status.textContent = message; status.hidden = !message; };
  const shouldPlay = () => visible && wantsPlayback && !document.hidden;
  const hasMetadata = () => videos().every(v => v.readyState >= 1);
  const buffered = () => videos().every(v => v.readyState >= 3 && !v.seeking);
  function pause() {
    if (!output.paused) { internalPauses++; output.pause(); }
    reconstruction.pause();
  }
  function align(force = false) {
    if (!paired() || !hasMetadata()) return;
    reconstruction.playbackRate = output.playbackRate;
    const time = Math.min(output.currentTime, Math.max(0, reconstruction.duration - .001));
    const drift = Math.abs(reconstruction.currentTime - time);
    if ((force && drift > .001) || drift > .035) {
      reconstruction.currentTime = time;
      lastCorrection = performance.now();
    }
  }
  async function resume() {
    if (starting || !shouldPlay() || !hasMetadata()) return;
    if (!buffered()) { pause(); return; }
    align();
    if (paired() && reconstruction.seeking) return;
    if (videos().every(v => !v.paused)) return;
    const request = epoch;
    starting = true;
    try {
      await Promise.all(videos().map(v => v.play()));
      if (request !== epoch || !shouldPlay()) pause();
      else report();
    } catch (error) {
      if (request === epoch && error.name !== "AbortError") {
        wantsPlayback = false; pause();
        report("Press Play in the generated video to start.");
      }
    } finally {
      starting = false;
      if (shouldPlay() && (request !== epoch || buffered()) && videos().some(v => v.paused)) queueMicrotask(resume);
    }
  }
  output.addEventListener("play", () => {
    internalPauses = 0; wantsPlayback = true;
    if (!shouldPlay() || !buffered()) pause();
    else { align(); if (paired()) reconstruction.play().catch(() => {}); }
  });
  output.addEventListener("pause", () => {
    if (internalPauses) internalPauses--; else wantsPlayback = false;
    reconstruction.pause();
  });
  output.addEventListener("seeking", () => { reconstruction.pause(); align(true); });
  output.addEventListener("seeked", () => { align(true); resume(); });
  output.addEventListener("ratechange", () => { align(); resume(); });
  reconstruction.addEventListener("seeked", resume);
  for (const video of [output, reconstruction]) {
    video.addEventListener("loadedmetadata", () => { align(true); resume(); });
    video.addEventListener("canplay", resume);
    video.addEventListener("waiting", () => { if (shouldPlay() && videos().includes(video)) pause(); });
    video.addEventListener("error", () => {
      if (!videos().includes(video)) return;
      pause(); report("This video could not be loaded. Please select the example again.");
    });
  }
  output.addEventListener("timeupdate", () => document.dispatchEvent(new CustomEvent("worldcore:time", {
    detail: { gallery: gallery.dataset.worldcoreGallery, id: selected.id, time: output.currentTime, frame: Math.floor(output.currentTime * selected.fps) },
  })));
  function select(id, updateUrl = true) {
    const example = examples.find(item => item.id === id);
    if (!example) return;
    epoch++; pause(); selected = example; wantsPlayback = true; report();
    gallery.dataset.selected = id;
    output.poster = example.poster;
    output.setAttribute("aria-label", example.title + " generated video");
    output.preload = visible || updateUrl ? "auto" : "none";
    output.pause();
    output.removeAttribute("src");
    output.dataset.pendingSrc = example.output;
    reconstruction.hidden = !paired();
    if (paired()) {
      reconstruction.preload = visible || updateUrl ? "auto" : "none";
      reconstruction.removeAttribute("src");
      reconstruction.dataset.pendingSrc = example.reconstruction;
    } else if (reconstruction.hasAttribute("src")) {
      reconstruction.removeAttribute("src"); reconstruction.load();
    }
    if (!paired()) delete reconstruction.dataset.pendingSrc;
    if (visible || updateUrl) loadMedia();
    internalPauses = 0;
    for (const button of buttons) {
      const active = button.dataset.demo === id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (updateUrl) {
      const url = new URL(location.href); url.searchParams.set(queryKey, id);
      try { history.replaceState(null, "", url); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent("worldcore:example", { detail: { id, title: example.title } }));
  }
  buttons.forEach(button => button.addEventListener("click", () => select(button.dataset.demo)));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) loadMedia();
      if (shouldPlay()) resume(); else pause();
    }, { rootMargin: "80px 0px", threshold: .01 }).observe(gallery.querySelector(".input-output"));
  } else visible = true;
  document.addEventListener("visibilitychange", () => { if (shouldPlay()) resume(); else pause(); });
  function sync(now) {
    if (paired() && shouldPlay() && hasMetadata() && !output.paused && !output.seeking && !reconstruction.seeking) {
      if (now - lastCorrection > 100) align();
      if (reconstruction.paused && buffered()) resume();
    }
    requestAnimationFrame(sync);
  }
  select(selected.id, false);
  requestAnimationFrame(sync);
  }
})();
