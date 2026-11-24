import { createPaperGesture } from "./paper-gesture";
import type { DiaryPage } from "./diary-page";
import type { DiaryStore, ReadingDay } from "./diary-store";
import { createPageTurn } from "./page-turn";
import { drawPhoto, drawStroke } from "./paper-render";
import { paperSize, wholePaper } from "./paper-viewport";
import { decodePhoto } from "./photo-import";

export function mountReadingPage(
  panel: HTMLElement,
  date: HTMLTimeElement,
  initialPage: DiaryPage,
  store: Pick<DiaryStore, "getPage" | "getReadingDay">,
  onSelect: (page: DiaryPage) => void,
): void {
  const canvas = document.createElement("canvas");
  canvas.className = "reading-canvas";
  canvas.width = paperSize.width;
  canvas.height = paperSize.height;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "阅读画纸");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  const paper = context;
  const under = document.createElement("canvas");
  under.className = "page-turn-under";
  under.width = paperSize.width;
  under.height = paperSize.height;
  under.setAttribute("aria-hidden", "true");
  const underPaper = under.getContext("2d");
  const stage = document.createElement("div");
  stage.className = "page-turn";
  const turn = createPageTurn(stage, (direction) => {
    void peek(direction === "older" ? older : direction === "newer" ? newer : undefined);
  }, (direction) => {
    const target = direction === "older" ? older : newer;
    if (target) selectPage(target);
  });
  const olderButton = turn.corner("older", "向旧翻");
  const newerButton = turn.corner("newer", "向新翻");
  stage.append(under, canvas, olderButton, newerButton);

  const tabs = document.createElement("div");
  tabs.className = "reading-page-tabs";
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "当天页签");
  tabs.hidden = true;
  const photoStatus = document.createElement("p");
  photoStatus.className = "photo-status";
  photoStatus.setAttribute("role", "status");
  const tabsStatus = document.createElement("p");
  tabsStatus.className = "photo-status";
  tabsStatus.setAttribute("role", "status");
  const paperViewport = document.createElement("div");
  paperViewport.className = "paper-viewport paper-viewport--reading";
  paperViewport.append(stage);
  panel.append(date, tabs, paperViewport, photoStatus, tabsStatus);

  let request = 0;
  let current = initialPage;
  let day: ReadingDay | undefined;
  let older: DiaryPage | undefined;
  let newer: DiaryPage | undefined;
  let peekRequest = 0;
  let preview: { id: string; images: Map<string, HTMLCanvasElement> } | undefined;
  let viewport = wholePaper;
  let displayedImages: ReadonlyMap<string, HTMLCanvasElement> | undefined;
  let previewPage: DiaryPage | undefined;
  const gesture = createPaperGesture(canvas, () => turn.reset(), (next) => {
    viewport = next;
    updateNavigation();
    paint(paper, current, displayedImages);
    if (previewPage && underPaper) paint(underPaper, previewPage, preview?.images);
  });
  canvas.addEventListener("paper-reset", () => gesture.reset());
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) gesture.down(event);
  });
  canvas.addEventListener("pointermove", (event) => { gesture.move(event); });
  canvas.addEventListener("pointerup", (event) => { gesture.end(event); });
  canvas.addEventListener("pointercancel", (event) => { gesture.end(event); });
  canvas.addEventListener("lostpointercapture", (event) => { gesture.end(event); });


  function updateNavigation(): void {
    const index = day?.pages.findIndex(({ id }) => id === current.id) ?? -1;
    older = day && index >= 0 ? day.pages[index - 1] ?? day.older : undefined;
    newer = day && index >= 0 ? day.pages[index + 1] ?? day.newer : undefined;
    const zoomed = viewport.scale > 1;
    olderButton.disabled = zoomed || !older;
    newerButton.disabled = zoomed || !newer;
    for (const button of [olderButton, newerButton]) {
      button.title = zoomed ? "先点整页再翻页" : "";
    }
    Array.from(tabs.children).forEach((tab, position) =>
      tab.setAttribute("aria-pressed", String(position === index)));
  }

  function selectPage(page: DiaryPage): void {
    if (page.id === current.id) return;
    turn.reset();
    const images = preview?.id === page.id ? preview.images : undefined;
    preview = undefined;
    const changedDate = page.recordDate !== current.recordDate;
    current = page;
    displayedImages = images;
    gesture.reset();
    if (changedDate) {
      day = undefined;
      tabs.replaceChildren();
      tabs.hidden = true;
      tabsStatus.textContent = "";
      void loadDay(page.recordDate);
    }
    updateNavigation();
    onSelect(page);
    void show(page, images);
  }

  function paint(
    target: CanvasRenderingContext2D, page: DiaryPage, images?: ReadonlyMap<string, HTMLCanvasElement>,
  ): void {
    target.resetTransform();
    target.clearRect(0, 0, paperSize.width, paperSize.height);
    target.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offset.x, viewport.offset.y);
    for (const photo of page.photos) {
      const image = images?.get(photo.assetId);
      if (image) drawPhoto(target, photo, image);
    }
    for (const stroke of page.strokes) drawStroke(target, stroke);
  }

  async function loadImages(page: DiaryPage, isCurrent: () => boolean) {
    const saved = await store.getPage(page.id);
    if (!saved || saved.photos.length === 0) throw new Error("Missing photo assets.");
    const images = new Map<string, HTMLCanvasElement>();
    for (const asset of saved.photos) {
      if (!isCurrent()) return images;
      const image = await decodePhoto(asset.preview ?? asset.original).catch(() => undefined);
      if (image) images.set(asset.id, image);
    }
    return images;
  }

  async function peek(page: DiaryPage | undefined): Promise<void> {
    const revision = ++peekRequest;
    previewPage = page;
    if (!page || !underPaper) return;
    preview = undefined;
    paint(underPaper, page);
    if (!page.photos.length) return;
    const isCurrent = () => stage.isConnected && revision === peekRequest;
    const images = await loadImages(page, isCurrent).catch(() => undefined);
    if (!images || !isCurrent()) return;
    preview = { id: page.id, images };
    paint(underPaper, page, images);
  }

  async function show(page: DiaryPage, cached?: Map<string, HTMLCanvasElement>): Promise<void> {
    const revision = ++request;
    const isCurrent = () => panel.isConnected && revision === request;
    date.dateTime = page.recordDate;
    date.textContent = page.recordDate;
    photoStatus.textContent = "";
    displayedImages = cached;
    paint(paper, page, cached);
    if (!page.photos.length) return;

    try {
      const images = cached ?? await loadImages(page, isCurrent);
      if (!isCurrent()) return;
      displayedImages = images;
      paint(paper, page, images);
      if (page.photos.some((photo) => !images.has(photo.assetId))) {
        photoStatus.textContent = "部分已贴照片无法打开。";
      }
    } catch {
      if (isCurrent()) photoStatus.textContent = "没能读取这一页的照片。";
    }
  }

  async function loadDay(recordDate: DiaryPage["recordDate"]): Promise<void> {
    try {
      const loaded = await store.getReadingDay(recordDate);
      if (!panel.isConnected || current.recordDate !== recordDate) return;
      day = loaded;
      if (loaded.pages.length > 1) {
        const buttons = loaded.pages.map((page, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = String(index + 1);
          button.setAttribute("aria-label", `第 ${index + 1} 页`);
          button.addEventListener("click", () => selectPage(page));
          return button;
        });
        tabs.replaceChildren(...buttons);
        tabs.hidden = false;
      }
      updateNavigation();
    } catch {
      if (panel.isConnected && current.recordDate === recordDate) {
        tabsStatus.textContent = "没能读取相邻页面。";
      }
    }
  }

  void show(initialPage);
  void loadDay(initialPage.recordDate);
}
