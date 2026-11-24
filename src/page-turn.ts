import "./page-turn.css";

type Direction = "older" | "newer";

export function createPageTurn(
  stage: HTMLElement,
  onPreview: (direction: Direction | undefined) => void,
  onTurn: (direction: Direction) => void,
) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let drag: { id: number; direction: Direction; x: number; y: number; moved: boolean } | undefined;
  let settling: number | undefined;
  let suppressClick = false;

  function reveal(direction: Direction, progress: number): void {
    if (!stage.dataset.turnDirection) onPreview(direction);
    stage.dataset.turnDirection = direction;
    stage.style.setProperty("--turn-spread", `${progress * 100}%`);
  }

  function reset(): void {
    window.clearTimeout(settling);
    settling = undefined;
    drag = undefined;
    stage.classList.remove("page-turn--settling", "page-turn--committed");
    if (stage.dataset.turnDirection) onPreview(undefined);
    delete stage.dataset.turnDirection;
    stage.style.removeProperty("--turn-spread");
  }

  function finish(direction: Direction, commit: boolean): void {
    if (reducedMotion.matches) {
      reset();
      if (commit) onTurn(direction);
      return;
    }
    if (!stage.dataset.turnDirection) reveal(direction, 0.08);
    // Establish the starting fold before applying the settling transition.
    stage.getBoundingClientRect();
    stage.classList.add("page-turn--settling");
    stage.classList.toggle("page-turn--committed", commit);
    reveal(direction, commit ? 1 : 0);
    settling = window.setTimeout(() => {
      reset();
      if (commit && stage.isConnected) onTurn(direction);
    }, 240);
  }

  function progress(event: PointerEvent, gesture: NonNullable<typeof drag>): number {
    const inward = (event.clientX - gesture.x) * (gesture.direction === "older" ? 1 : -1);
    const upward = gesture.y - event.clientY;
    return Math.max(0, inward + upward * 0.65) / Math.max(stage.clientWidth, 1);
  }

  function corner(direction: Direction, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-turn-corner page-turn-corner--${direction}`;
    button.setAttribute("aria-label", label);
    button.disabled = true;
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || drag || settling !== undefined) return;
      suppressClick = false;
      drag = { id: event.pointerId, direction, x: event.clientX, y: event.clientY, moved: false };
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6;
      if (drag.moved && !reducedMotion.matches) reveal(direction, Math.min(0.92, progress(event, drag)));
    });
    button.addEventListener("pointerup", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const gesture = drag;
      drag = undefined;
      suppressClick = gesture.moved
        || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6;
      if (!suppressClick) return;
      finish(direction, progress(event, gesture) >= 0.24);
    });
    function cancel(event: PointerEvent): void {
      if (!drag || event.pointerId !== drag.id) return;
      const wasVisible = !!stage.dataset.turnDirection;
      drag = undefined;
      suppressClick = true;
      if (wasVisible) finish(direction, false);
    }
    button.addEventListener("pointercancel", cancel);
    button.addEventListener("lostpointercapture", cancel);
    button.addEventListener("click", (event) => {
      if (event.detail > 0 && suppressClick) {
        suppressClick = false;
        return;
      }
      if (!button.disabled && settling === undefined) finish(direction, true);
    });
    return button;
  }

  return { corner, reset };
}
