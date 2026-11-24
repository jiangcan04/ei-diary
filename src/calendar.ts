import { getDiaryDate, type DiaryDate } from "./diary-page";
import "./calendar.css";

export function createCalendar(month: Date, onSelect: (date: DiaryDate) => void): HTMLTableElement {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstColumn = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const table = document.createElement("table");
  table.className = "calendar-grid";
  table.style.setProperty("--calendar-weeks", String(Math.ceil((firstColumn + days) / 7)));
  table.setAttribute("role", "table");
  table.setAttribute("aria-label", `${year}年${monthIndex + 1}月日历`);

  const head = table.createTHead();
  head.setAttribute("role", "rowgroup");
  const header = head.insertRow();
  header.setAttribute("role", "row");
  for (const weekday of ["一", "二", "三", "四", "五", "六", "日"]) {
    const label = document.createElement("th");
    label.scope = "col";
    label.setAttribute("role", "columnheader");
    label.textContent = weekday;
    header.append(label);
  }

  const body = table.createTBody();
  body.setAttribute("role", "rowgroup");
  for (let start = 0; start < firstColumn + days; start += 7) {
    const row = body.insertRow();
    row.setAttribute("role", "row");
    for (let column = 0; column < 7; column++) {
      const cell = row.insertCell();
      cell.setAttribute("role", "cell");
      const day = start + column - firstColumn + 1;
      if (day < 1 || day > days) continue;

      const date = document.createElement("time");
      date.dateTime = getDiaryDate(new Date(year, monthIndex, day, 12));
      date.textContent = String(day);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.setAttribute("aria-label", date.dateTime);
      button.append(date);
      button.onclick = () => onSelect(date.dateTime);
      cell.append(button);
    }
  }
  return table;
}

export function addCalendarPreview(
  day: HTMLButtonElement, count: number, imageUrl: string | undefined, onOpen: () => void,
): void {
  const preview = day;
  preview.classList.add("calendar-preview", "calendar-day--has-preview");
  preview.classList.toggle("calendar-preview--stacked", count > 1);
  preview.setAttribute("aria-label", `打开 ${day.getAttribute("aria-label")} 最新一页，共 ${count} 页`);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    const content = document.createElement("span");
    content.className = "calendar-preview-content";
    content.setAttribute("aria-hidden", "true");
    content.append(image);
    preview.append(content);
  }
  preview.onclick = onOpen;
  const date = day.querySelector<HTMLTimeElement>("time");
  preview.classList.toggle("calendar-preview--today", date?.dateTime === getDiaryDate(new Date()));
}

export function trackCalendarToday(table: HTMLTableElement): () => void {
  let timer: number;
  const dates = table.querySelectorAll("time");
  const refresh = () => {
    window.clearTimeout(timer);
    const now = new Date();
    const today = getDiaryDate(now);
    dates.forEach((date) => {
      if (date.dateTime === today) date.setAttribute("aria-current", "date");
      else date.removeAttribute("aria-current");
      date.closest(".calendar-preview")?.classList.toggle(
        "calendar-preview--today", date.dateTime === today);
    });

    const next = new Date(now.getTime());
    next.setHours(2, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
    }
    timer = window.setTimeout(refresh, next.getTime() - now.getTime());
  };

  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  refresh();
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pageshow", refresh);
  };
}
