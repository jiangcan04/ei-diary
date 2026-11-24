/** Keep a gesture that starts on tools owned by that control until release. */
export function isolateToolTouch(region: HTMLElement): void {
  const pointers = new Map<number, { x: number; y: number; moved: boolean }>();
  let suppressClick = false;

  region.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!pointers.size) suppressClick = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
    if (pointers.size > 1) {
      suppressClick = true;
      pointers.forEach((pointer) => { pointer.moved = true; });
    }
    const target = (event.target as Element).closest<HTMLElement>("button, input, label") ?? region;
    target.setPointerCapture(event.pointerId);
    event.stopPropagation();
  });

  function movement(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointer.moved ||= Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6;
    if (pointer.moved) {
      suppressClick = true;
      event.preventDefault();
    }
    event.stopPropagation();
  }

  region.addEventListener("pointermove", movement);
  region.addEventListener("pointerup", (event) => {
    movement(event);
    pointers.delete(event.pointerId);
  });
  function cancel(event: PointerEvent): void {
    if (!pointers.delete(event.pointerId)) return;
    suppressClick = true;
    event.stopPropagation();
  }
  region.addEventListener("pointercancel", cancel);
  region.addEventListener("lostpointercapture", cancel);
  region.addEventListener("click", (event) => {
    if (event.detail === 0 || !suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  region.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    suppressClick = true;
  });
}
