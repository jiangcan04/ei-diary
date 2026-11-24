export function resetPaperViewport(panel: HTMLElement): void {
  panel.querySelector("canvas.ink-canvas, canvas.reading-canvas")
    ?.dispatchEvent(new Event("paper-reset"));
}

/** Fit the complete paper into the space remaining below navigation and tools. */
export function fitPaperToScreen(panel: HTMLElement): () => void {
  const viewport = panel.querySelector<HTMLElement>(".paper-viewport");
  if (!viewport) return () => {};
  let frame = 0;
  let previousSize = "";
  function fit(): void {
    if (!panel.isConnected || !viewport) return;
    const screen = window.visualViewport;
    const visibleBottom = (screen?.offsetTop ?? 0) + (screen?.height ?? window.innerHeight);
    const workspace = viewport.closest(".photo-workspace") ?? viewport;
    const children = Array.from(panel.children);
    const gap = parseFloat(getComputedStyle(panel).rowGap) || 0;
    let footer = 0;
    for (const element of children.slice(children.indexOf(workspace) + 1)) {
      const style = getComputedStyle(element);
      const height = element.getBoundingClientRect().height;
      if (!height || style.position === "absolute" || style.position === "fixed") continue;
      footer += height + (parseFloat(style.marginTop) || 0)
        + (parseFloat(style.marginBottom) || 0) + gap;
    }
    const padding = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
    const height = Math.max(1, Math.floor(visibleBottom - viewport.getBoundingClientRect().top
      - footer - padding - 8));
    const value = height + "px";
    if (viewport.style.getPropertyValue("--paper-workspace-height") !== value) {
      viewport.style.setProperty("--paper-workspace-height", value);
    }
    viewport.scrollLeft = viewport.scrollTop = 0;
    const bounds = viewport.getBoundingClientRect();
    const size = bounds.width + ":" + bounds.height;
    if (size !== previousSize) {
      previousSize = size;
      resetPaperViewport(panel);
    }
  }
  function schedule(): void {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(panel);
  window.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  fit();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
  };
}
