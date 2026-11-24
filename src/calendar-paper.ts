import "./calendar-paper.css";

export function mountCalendarPaper(
  panel: HTMLElement,
  heading: HTMLHeadingElement,
  grid: HTMLTableElement,
  controls: {
    previous: HTMLButtonElement;
    next: HTMLButtonElement;
    close: HTMLButtonElement;
    add: HTMLButtonElement;
    menu: HTMLElement;
  },
): void {
  panel.classList.add("calendar-screen");
  const header = document.createElement("header");
  header.className = "calendar-toolbar";

  const months = document.createElement("div");
  months.className = "calendar-month-nav";
  months.append(controls.previous, heading, controls.next);
  for (const [button, symbol] of [[controls.previous, "‹"], [controls.next, "›"]] as const) {
    button.setAttribute("aria-label", button.textContent ?? "");
    button.textContent = symbol;
  }

  controls.close.className = "calendar-icon calendar-close";
  controls.add.className = "calendar-icon calendar-add";
  for (const button of [controls.close, controls.add]) {
    button.setAttribute("aria-label", button.textContent ?? "");
    button.textContent = "";
  }
  header.append(controls.close, months, controls.menu);

  const scene = document.createElement("div");
  scene.className = "calendar-scene";
  const lamp = document.createElement("div");
  lamp.className = "calendar-lamp";
  lamp.setAttribute("aria-hidden", "true");
  for (const part of ["shade", "pole", "base"]) {
    const piece = document.createElement("span");
    piece.className = `lamp-${part}`;
    lamp.append(piece);
  }
  const paper = document.createElement("div");
  paper.className = "calendar-paper";
  paper.append(grid);
  scene.append(lamp, paper);

  panel.append(header, scene, controls.add);
}
