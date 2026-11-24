import { getDiaryDate } from "./diary-page";
import "./cover.css";

export function createCover(onOpen: () => void): [HTMLTimeElement, HTMLButtonElement] {
  const date = document.createElement("time");
  const diaryDate = getDiaryDate(new Date());
  const [, month, day] = diaryDate.split("-").map(Number);
  date.className = "cover-date";
  date.dateTime = diaryDate;
  date.textContent = `${month}月${day}日`;

  const book = document.createElement("button");
  book.className = "cover-book";
  book.type = "button";
  book.setAttribute("aria-label", "打开日记本");

  const artwork = document.createElement("span");
  artwork.className = "cover-artwork";
  artwork.setAttribute("aria-hidden", "true");

  for (const layer of ["cloud", "cloud-small", "hill", "meadow", "land", "spine"]) {
    const piece = document.createElement("span");
    piece.className = `cover-${layer}`;
    artwork.append(piece);
  }

  book.append(artwork);
  book.addEventListener("click", async () => {
    book.disabled = true;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const opening = artwork.animate([
        { transform: "rotateY(0deg)" },
        { transform: "rotateY(-105deg)" },
      ], { duration: 420, easing: "ease-in-out", fill: "forwards" });
      await opening.finished;
    }
    onOpen();
  });

  return [date, book];
}
