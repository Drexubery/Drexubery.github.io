(() => {
  const loadVideo = video => {
    if (!video.dataset.src) return;
    video.src = video.dataset.src;
    delete video.dataset.src;
    video.load();
  };
  document.querySelectorAll("[data-placeholder-link]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (!link.getAttribute("href") || link.getAttribute("href") === "#") event.preventDefault();
    })
  );

  document.querySelectorAll(".copy h2, .copy h3[id]").forEach((heading) => {
    const anchorId = heading.id || heading.closest(".article-section")?.id;
    if (!anchorId || heading.querySelector(".anchor-link")) return;
    heading.classList.add("anchored-heading");
    const link = document.createElement("a");
    link.className = "anchor-link";
    link.href = `#${anchorId}`;
    link.setAttribute("aria-label", "Copy link to this section");
    link.title = "Copy link to this section";
    link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 1 1 0 10h-2"></path><line x1="8" x2="16" y1="12" y2="12"></line></svg>';
    heading.append(link);
  });

  const tocLinks = [...document.querySelectorAll("[data-toc-target]")];
  const tocGroups = [...document.querySelectorAll("[data-toc-group]")];
  const tocOrder = tocLinks
    .map((link) => document.getElementById(link.dataset.tocTarget))
    .filter((target, index, all) => target && all.indexOf(target) === index);

  const updateToc = () => {
    if (!tocLinks.length) return;
    const marker = window.scrollY + 160;
    let active = tocOrder[0];
    tocOrder.forEach((target) => {
      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      if (targetTop <= marker) active = target;
    });
    // A short final section cannot reach the top marker at the end of the page.
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = tocOrder[tocOrder.length - 1];
    }
    const activeId = active?.id || tocOrder[0]?.id;
    tocLinks.forEach((link) => {
      if (link.dataset.tocTarget === activeId) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    const activeGroup = activeId;
    tocGroups.forEach((group) =>
      group.classList.toggle("is-current", group.dataset.tocGroup === activeGroup)
    );
  };

  window.addEventListener("scroll", updateToc, { passive: true });
  updateToc();

  document.querySelectorAll(".segmented").forEach((control) => {
    const buttons = [...control.querySelectorAll("button")];
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
      });
    });
  });

  const nvsCaseButtons = [...document.querySelectorAll('[data-nvs-case]')];
  const nvsPanels = [...document.querySelectorAll('[data-nvs-panel]')];
  nvsCaseButtons.forEach(button => button.addEventListener('click', () => {
    nvsCaseButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    nvsPanels.forEach(panel => {
      const selected = panel.id === button.dataset.nvsCase;
      panel.hidden = !selected;
      panel.querySelectorAll('video').forEach(video => {
        if (!selected) video.pause();
      });
    });
  }));
  const nvs = document.querySelector('[data-nvs]');
  if (nvs) {
    const slider = nvs.querySelector('input[type="range"]');
    const videos = [...nvs.querySelectorAll('[data-nvs-video]')];
    const inputs = [...nvs.querySelectorAll('[data-nvs-input]')];
    const status = nvs.querySelector('#nvs-status');
    const messages = ['Novel views from a single input image', 'Novel views from two input images', 'Novel views from three input images'];
    let visible = false;
    const update = () => {
      const position = Number(slider.value) - 1;
      const lower = Math.min(1, Math.floor(position));
      const mix = position - lower;
      const blend = mix * mix * (3 - 2 * mix);
      const selected = Math.round(position);
      videos.forEach((video, i) => {
        video.style.opacity = i === lower ? '1' : i === lower + 1 ? String(blend) : '0';
        video.style.zIndex = i === lower + 1 ? '2' : i === lower ? '1' : '0';
        video.setAttribute('aria-hidden', String(i !== selected));
      });
      inputs.forEach((input, i) => {
        const masked = i > selected;
        input.classList.toggle('is-masked', masked);
        input.setAttribute('aria-label', 'Input view ' + (i + 1) + (masked ? ', not used' : ', used'));
      });
      slider.style.setProperty('--nvs-progress', (position * 50) + '%');
      slider.setAttribute('aria-valuetext', (selected + 1) + ' input image' + (selected ? 's' : ''));
      status.textContent = messages[selected];
    };
    slider.addEventListener('input', update);
    slider.addEventListener('change', () => { slider.value = Math.round(Number(slider.value)); update(); });
    slider.addEventListener('keydown', event => {
      const stops = {ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1};
      if (event.key in stops || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        slider.value = event.key === 'Home' ? 1 : event.key === 'End' ? 3 : Math.max(1, Math.min(3, Math.round(Number(slider.value)) + stops[event.key]));
        update();
      }
    });
    const playback = () => videos.forEach(video => {
      if (visible && !document.hidden) { loadVideo(video); video.play().catch(() => {}); }
      else video.pause();
    });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; playback(); }, {threshold: .1}).observe(nvs);
    document.addEventListener('visibilitychange', playback);
    // Compare the same camera position instead of restarting on selection.
    window.setInterval(() => {
      const master = videos[0];
      if (!visible || document.hidden || master.paused || !(master.duration > 0)) return;
      for (const video of videos.slice(1)) {
        if (video.readyState < 2 || !(video.duration > 0) || video.seeking) continue;
        const target = master.currentTime / master.duration * video.duration;
        if (Math.abs(video.currentTime - target) > .05) video.currentTime = target;
        if (video.paused) video.play().catch(() => {});
      }
    }, 250);
    update();
  }
  const videos = [...document.querySelectorAll("video:not([data-sync-video])")];
  const videoObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target;
            if (entry.isIntersecting) {
              loadVideo(video);
              const playback = video.play();
              if (playback?.catch) playback.catch(() => {});
            } else if (!video.controls || video.paused) {
              video.pause();
            }
          });
        },
        { rootMargin: "180px 0px", threshold: 0.01 }
      )
    : null;

  videos.forEach((video) => {
    if (video.muted) video.setAttribute("muted", "");
    videoObserver?.observe(video);
  });
})();
