/** A local calendar day formatted as YYYY-MM-DD. */
export type DiaryDate = string;

export interface PaperPoint {
  readonly x: number;
  readonly y: number;
}

export interface Stroke {
  readonly points: readonly PaperPoint[];
  readonly color: string;
  readonly width: number;
}

export interface PhotoPlacement {
  readonly id: string;
  readonly assetId: string;
  readonly position: PaperPoint;
  readonly width: number;
  readonly height: number;
}

export interface DiaryPage {
  readonly id: string;
  readonly recordDate: DiaryDate;
  /** The instant this page was created, in Unix milliseconds. */
  readonly createdAt: number;
  readonly strokes: readonly Stroke[];
  readonly photos: readonly PhotoPlacement[];
}

export function getDiaryDate(time: Date): DiaryDate {
  const day = new Date(time.getTime());
  if (time.getHours() < 2) {
    // Move by a local calendar day, even when the day is not 24 hours long.
    day.setHours(12);
    day.setDate(day.getDate() - 1);
  }

  const year = String(day.getFullYear()).padStart(4, "0");
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function createDiaryPage(
  time: Date = new Date(),
  recordDate: DiaryDate = getDiaryDate(time),
): DiaryPage {
  return {
    id: crypto.randomUUID(),
    recordDate,
    createdAt: time.getTime(),
    strokes: [],
    photos: [],
  };
}

export function changeDiaryDate(page: DiaryPage, recordDate: DiaryDate): DiaryPage {
  return { ...page, recordDate };
}

/** Map paper coordinates to view coordinates without modifying stored content. */
export function toViewportPoint(
  point: PaperPoint,
  scale: number,
  offset: PaperPoint,
): PaperPoint {
  return { x: point.x * scale + offset.x, y: point.y * scale + offset.y };
}
