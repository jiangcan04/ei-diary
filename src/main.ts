import { createManualSave, type ManualSaveState } from "./manual-save";
import { isolateToolTouch } from "./tool-touch";
import { fitPaperToScreen, resetPaperViewport } from "./fit-paper";
import { appTitle } from "./app-title";
import { installAppUpdates } from "./app-updates";
import { createBackupMenu } from "./backup-menu";
import { defaultBrush } from "./brush-settings";
import { mountCalendarPaper } from "./calendar-paper";
import { addCalendarPreview, createCalendar, trackCalendarToday } from "./calendar";
import { createCover } from "./cover";
import { changeDiaryDate, createDiaryPage, getDiaryDate, type DiaryDate, type DiaryPage, type PaperPoint, type PhotoPlacement } from "./diary-page";
import { DiaryStore, type PhotoAsset } from "./diary-store";
import { createEditorTools } from "./editor-tools";
import { createInkCanvas } from "./ink-canvas";
import { createPageAutosave } from "./page-autosave";
import { createPageThumbnail } from "./page-thumbnail";
import { drawPhoto } from "./paper-render";
import { decodePhoto, placeImportedPhoto, preparePhotos } from "./photo-import";
import { arrangePhotosInView, movePhoto, photoAt, scalePhoto } from "./photo-placement";
import { mountReadingPage } from "./reading-page";
import "./style.css";
import "./visual-assets.css";

type View = "cover" | "calendar" | "reading" | "editing";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing app element.");
const app = root;
const setUpdateEditingState = installAppUpdates();

const store = new DiaryStore();
let calendarMonth = new Date();
let readingPage: DiaryPage | undefined;
let draft: DiaryPage | undefined;
let selectedThumbnailUrl: string | undefined;
let stopFittingPaper: (() => void) | undefined;
let stopTrackingToday: (() => void) | undefined;
let releaseCalendarPreviews: (() => void) | undefined;
let editingFrom: "calendar" | "reading" = "calendar";

function action(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function changeMonth(delta: number): void {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
  render("calendar");
}

function openBook(): void {
  const [year, month] = getDiaryDate(new Date()).split("-").map(Number);
  calendarMonth = new Date(year, month - 1, 1);
  render("calendar");
}

function openEditor(from: typeof editingFrom): void {
  editingFrom = from;
  draft = from === "reading" ? readingPage : createDiaryPage();
  render("editing");
}

function openNewPageForDate(date: DiaryDate): void {
  editingFrom = "calendar";
  draft = createDiaryPage(new Date(), date);
  render("editing");
}

function clearSelectedThumbnail(): void {
  if (selectedThumbnailUrl) URL.revokeObjectURL(selectedThumbnailUrl);
  selectedThumbnailUrl = undefined;
}

function mountCalendar(panel: HTMLElement, heading: HTMLHeadingElement): void {
  const actions = document.createElement("div");
  actions.className = "calendar-date-actions";
  const table = createCalendar(calendarMonth, selectDate);
  const previewUrls = new Set<string>();
  releaseCalendarPreviews = () => {
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
  };
  let selection = 0;
  let previewRequest = 0;

  function openPage(page: DiaryPage): void {
    readingPage = page;
    render("reading");
  }

  async function loadPreviews(): Promise<void> {
    const request = ++previewRequest;
    const buttons = Array.from(table.querySelectorAll<HTMLButtonElement>(".calendar-day"));
    const days = new Map(buttons.map((button) => [button.querySelector("time")?.getAttribute("datetime"), button]));
    const dates = [...days.keys()];
    const first = dates[0];
    const last = dates.at(-1);
    if (!first || !last) return;
    const records = await store.getCalendarDays(first, last);
    for (const { page, count, thumbnail } of records) {
      if (!panel.isConnected || request !== previewRequest) return;
      const day = days.get(page.recordDate);
      if (!day) continue;
      // Older pages can predate thumbnail generation.
      const image = thumbnail ?? await (async () => {
        const saved = await store.getPage(page.id);
        if (!saved) return undefined;
        const assets = new Map(saved.photos.map((asset) => [asset.id, asset]));
        return createPageThumbnail(saved.page, assets);
      })().catch(() => undefined);
      if (!panel.isConnected || request !== previewRequest) return;
      const url = image && URL.createObjectURL(image);
      if (url) previewUrls.add(url);
      addCalendarPreview(day, count, url, () => openPage(page));
    }
  }

  function refreshPreviews(): void {
    if (!panel.isConnected) return;
    selection++;
    clearSelectedThumbnail();
    actions.replaceChildren();
    releaseCalendarPreviews?.();
    table.querySelectorAll<HTMLButtonElement>(".calendar-day--has-preview").forEach((day) => {
      day.classList.remove("calendar-day--has-preview", "calendar-preview",
        "calendar-preview--stacked", "calendar-preview--today");
      day.querySelector(".calendar-preview-content")?.remove();
      const date = day.querySelector<HTMLTimeElement>("time");
      if (date) {
        day.setAttribute("aria-label", date.dateTime);
        day.onclick = () => { void selectDate(date.dateTime); };
      }
    });
    void loadPreviews().catch(() => {});
  }

  async function selectDate(date: DiaryDate): Promise<void> {
    const request = ++selection;
    clearSelectedThumbnail();
    actions.replaceChildren();
    if (date > getDiaryDate(new Date())) {
      showMessage("这一天还没到。");
      return;
    }

    try {
      const existing = await store.getLatestPageForDate(date);
      if (!panel.isConnected || request !== selection) return;

      if (!existing) {
        openNewPageForDate(date);
        return;
      }

      openPage(existing.page);
    } catch {
      if (panel.isConnected && request === selection) showMessage("没能读取这一天，请再试一次。");
    }
  }

  function showMessage(message: string): void {
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = message;
    actions.replaceChildren(status);
  }

  heading.textContent = `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月`;
  mountCalendarPaper(panel, heading, table, {
    previous: action("上个月", () => changeMonth(-1)),
    next: action("下个月", () => changeMonth(1)),
    add: action("添一页", () => openEditor("calendar")),
    close: action("合上日记本", () => render("cover")),
    menu: createBackupMenu(store, refreshPreviews),
  });
  panel.append(actions);
  void loadPreviews().catch(() => {
    // Calendar navigation and individual date lookups still work.
  });
}

function recordDateElement(recordDate: DiaryDate): HTMLTimeElement {
  const date = document.createElement("time");
  date.dateTime = recordDate;
  date.textContent = recordDate;
  return date;
}

function mountEditor(panel: HTMLElement, page: DiaryPage, from: typeof editingFrom): void {
  const history: DiaryPage[] = [];
  const images = new Map<string, HTMLCanvasElement>();
  const assets = new Map<string, PhotoAsset>();
  let savedAssetIds = new Set(page.photos.map((photo) => photo.assetId));
  let initialAssets: Promise<readonly PhotoAsset[]> | undefined;
  let persisted = from === "reading";
  let current = page;
  let brush = defaultBrush;
  let erasing = false;
  let placingPhotos = false;
  let selectedId: string | undefined;
  let drag: { photo: PhotoPlacement; start: PaperPoint } | undefined;
  let preview: PhotoPlacement | undefined;
  let importing = false;
  let leaving = false;
  let storageFailed = false;

  const date = recordDateElement(page.recordDate);
  const dateForm = document.createElement("form");
  dateForm.id = "record-date-form";
  dateForm.className = "record-date-form";
  dateForm.hidden = true;
  dateForm.noValidate = true;
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.required = true;
  dateInput.setAttribute("aria-label", "记录日期");
  const dateButton = action("", () => {
    if (!dateForm.hidden) {
      closeDateForm();
      return;
    }
    dateInput.max = getDiaryDate(new Date());
    dateInput.value = current.recordDate;
    dateForm.hidden = false;
    dateButton.setAttribute("aria-expanded", "true");
    dateInput.focus();
  });
  dateButton.className = "record-date-button";
  dateButton.setAttribute("aria-label", "修改记录日期");
  dateButton.setAttribute("aria-controls", dateForm.id);
  dateButton.setAttribute("aria-expanded", "false");
  dateButton.append(date);
  const applyDate = document.createElement("button");
  applyDate.type = "submit";
  applyDate.textContent = "应用日期";
  dateForm.append(dateInput, applyDate, action("取消改日期", closeDateForm));
  dateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    dateInput.max = getDiaryDate(new Date());
    if (!dateInput.reportValidity()) return;
    const nextDate = dateInput.value;
    if (nextDate !== current.recordDate) commit(changeDiaryDate(current, nextDate));
    closeDateForm();
  });

  function closeDateForm(): void {
    dateForm.hidden = true;
    dateButton.setAttribute("aria-expanded", "false");
    dateButton.focus();
  }

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.multiple = true;
  picker.hidden = true;
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.className = "photo-status";

  const saveStatus = document.createElement("div");
  saveStatus.setAttribute("role", "status");
  saveStatus.className = "save-status";
  const retry = action("重试保存", () => { void manualSave.save(); });
  retry.hidden = true;
  const back = action("返回", () => { void leaveEditor(); });
  const autosave = createPageAutosave(saveSnapshot, (failed) => {
    storageFailed = failed;
    saveStatus.textContent = failed ? "没能保存，这一页还在。请重试。" : "";
    retry.hidden = !failed;
    if (failed) showManualSave("failed");
  });

  const editorMenu = document.createElement("div");
  editorMenu.id = "editor-menu";
  editorMenu.hidden = true;
  const menuButton = action("···", () => setMenuOpen(editorMenu.hidden));
  menuButton.setAttribute("aria-label", "编辑菜单");
  menuButton.setAttribute("aria-controls", editorMenu.id);
  setMenuOpen(false);

  const deleteDialog = document.createElement("dialog");
  deleteDialog.className = "delete-page-dialog";
  const deleteTitle = document.createElement("h2");
  deleteTitle.id = "delete-page-title";
  deleteTitle.textContent = "删除这一页？";
  deleteDialog.setAttribute("aria-labelledby", deleteTitle.id);
  const deleteStatus = document.createElement("p");
  deleteStatus.setAttribute("role", "status");
  const cancelDelete = action("取消删除", () => deleteDialog.close());
  cancelDelete.autofocus = true;
  const confirmDelete = action("确认删除", () => { void deleteCurrentPage(); });
  deleteDialog.append(deleteTitle, deleteStatus, cancelDelete, confirmDelete);
  deleteDialog.addEventListener("cancel", (event) => {
    if (confirmDelete.disabled) event.preventDefault();
  });
  deleteDialog.addEventListener("close", () => menuButton.focus());
  editorMenu.append(action("删除整页", () => {
    setMenuOpen(false);
    deleteStatus.textContent = "";
    deleteDialog.showModal();
  }));
  const navigation = document.createElement("div");
  navigation.className = "page-topbar editor-topbar";
  back.textContent = "‹";
  back.setAttribute("aria-label", "返回");
  const editorActions = document.createElement("div");
  editorActions.className = "page-topbar-actions";
  const saveSlot = document.createElement("div");
  saveSlot.className = "editor-save-slot";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "editor-save-button";
  saveButton.textContent = "保存";
  saveButton.setAttribute("aria-label", "保存");
  saveButton.disabled = false;
  const saveDescription = document.createElement("span");
  saveDescription.id = "editor-save-description";
  saveDescription.className = "visually-hidden";
  saveDescription.textContent = "保存当前修改，继续留在画纸。自动保存仍然生效。";
  saveButton.setAttribute("aria-describedby", saveDescription.id);
  const saveHint = document.createElement("span");
  saveHint.className = "editor-save-hint";
  saveHint.hidden = true;
  saveHint.setAttribute("role", "status");
  let saveFeedbackTimer = 0;
  let manualState: ManualSaveState = "idle";
  const saveError = document.createElement("div");
  saveError.className = "editor-save-error";
  saveError.hidden = true;
  saveError.append(saveStatus, retry);
  isolateToolTouch(saveError);
  function showManualSave(state: ManualSaveState): void {
    if (storageFailed && state === "idle") state = "failed";
    window.clearTimeout(saveFeedbackTimer);
    manualState = state;
    saveButton.textContent = state === "saving" ? "保存中…" : state === "saved" ? "已保存" : state === "failed" ? "保存失败" : "保存";
    saveButton.disabled = state === "saving";
    saveButton.setAttribute("aria-busy", String(state === "saving"));
    saveError.hidden = state !== "failed";
    if (state === "failed") {
      saveStatus.textContent = "没能保存，这一页还在。请重试。";
      retry.hidden = false;
    }
    saveHint.textContent = state === "empty" ? "画一笔或贴张照片再保存。"
      : state === "blocked" ? "请先结束当前操作，再保存。"
      : state === "saved" ? "已保存" : "";
    saveHint.hidden = !saveHint.textContent;
    if (state === "saved" || state === "empty" || state === "blocked") {
      saveFeedbackTimer = window.setTimeout(() => {
        if (panel.isConnected && manualState === state) showManualSave("idle");
      }, 1800);
    }
  }
  const manualSave = createManualSave({
    snapshot: () => current,
    isEmptyNewPage: () => from === "calendar" && !persisted && !current.strokes.length && !current.photos.length,
    isInteracting: () => importing || !!drag || drawing.isInteracting(),
    schedule: (snapshot) => autosave.schedule(snapshot),
    flush: () => autosave.flush(),
    retry: () => autosave.retry(),
  }, showManualSave);
  saveButton.addEventListener("click", () => { void manualSave.save(); });
  saveSlot.append(saveButton, saveDescription, saveHint, saveError);
  editorActions.append(action("整页", () => resetPaperViewport(panel)), saveSlot, menuButton);
  navigation.append(back, dateButton, editorActions);

  function setMenuOpen(open: boolean): void {
    editorMenu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
  }

  async function deleteCurrentPage(): Promise<void> {
    cancelDelete.disabled = true;
    confirmDelete.disabled = true;
    deleteStatus.textContent = "正在删除…";
    try {
      // Finish any in-flight write before deleting so it cannot recreate this page.
      await autosave.flush();
      await store.deletePage(current.id);
    } catch {
      deleteStatus.textContent = "没能删除，这一页还在。请重试。";
      cancelDelete.disabled = false;
      confirmDelete.disabled = false;
      confirmDelete.focus();
      return;
    }
    deleteDialog.close();
    draft = undefined;
    readingPage = undefined;
    render("calendar");
  }

  const photoActions = document.createElement("div");
  photoActions.className = "photo-actions";
  isolateToolTouch(photoActions);
  const shrinkPhoto = action("缩小照片", () => resizeSelected(0.8));
  const enlargePhoto = action("放大照片", () => resizeSelected(1.25));
  const removePhoto = action("移除照片", () => {
    if (selectedId === undefined || drag) return;
    const next = current.photos.filter((photo) => photo.id !== selectedId);
    if (next.length === current.photos.length) return;
    selectedId = undefined;
    commit({ ...current, photos: next });
    updatePhotoStatus();
  });
  photoActions.setAttribute("role", "group");
  photoActions.setAttribute("aria-label", "选中照片操作");
  photoActions.append(shrinkPhoto, enlargePhoto, removePhoto);

  const drawing = createInkCanvas(page.strokes, (strokes) => {
    commit({ ...current, strokes });
  }, () => brush, () => erasing, () => placingPhotos, (context) => {
    for (const saved of current.photos) {
      const placement = preview?.id === saved.id ? preview : saved;
      const image = images.get(placement.assetId);
      if (image) drawPhoto(context, placement, image);
    }
    const selection = placingPhotos ? preview ?? selectedPhoto() : undefined;
    if (selection) {
      context.save();
      context.strokeStyle = "#475d42";
      context.lineWidth = 2;
      context.setLineDash([6, 4]);
      context.strokeRect(selection.position.x, selection.position.y, selection.width, selection.height);
      context.restore();
    }
  }, {
    begin(point) {
      const photo = photoAt(current.photos, point);
      selectedId = photo?.id;
      drag = photo ? { photo, start: point } : undefined;
      updatePhotoActions();
      drawing.redraw();
    },
    move(point) {
      if (!drag) return;
      preview = draggedTo(point);
      drawing.redraw();
    },
    end(point) {
      const next = drag ? draggedTo(point) : undefined;
      const original = drag?.photo;
      drag = undefined;
      preview = undefined;
      if (next && original && Math.hypot(
        next.position.x - original.position.x, next.position.y - original.position.y,
      ) >= 2) replacePhoto(next);
      else drawing.redraw();
      updatePhotoActions();
    },
    cancel: cancelPhotoDrag,
  });

  const tools = createEditorTools(
    (settings) => { brush = settings; },
    (selected) => {
      erasing = selected;
      drawing.canvas.classList.toggle("ink-canvas--eraser", selected);
    },
    () => {
      if (drag) cancelPhotoDrag();
      const previous = history.pop();
      if (previous) {
        showPage(previous);
        updatePhotoStatus();
      }
    },
    () => {
      picker.value = "";
      picker.click();
    },
    () => setPlacingPhotos(false),
    () => setPlacingPhotos(true),
  );

  function selectedPhoto(): PhotoPlacement | undefined {
    return current.photos.find((photo) => photo.id === selectedId);
  }

  function draggedTo(point: PaperPoint): PhotoPlacement | undefined {
    if (!drag) return undefined;
    return movePhoto(drag.photo, {
      x: drag.photo.position.x + point.x - drag.start.x,
      y: drag.photo.position.y + point.y - drag.start.y,
    });
  }

  function cancelPhotoDrag(): void {
    drag = undefined;
    preview = undefined;
    updatePhotoActions();
    drawing.redraw();
  }

  function replacePhoto(next: PhotoPlacement): void {
    commit({ ...current, photos: current.photos.map((photo) => photo.id === next.id ? next : photo) });
  }

  function resizeSelected(factor: number): void {
    const photo = selectedPhoto();
    if (!photo || drag) return;
    const next = scalePhoto(photo, factor);
    if (next.width !== photo.width || next.height !== photo.height) replacePhoto(next);
  }

  function updatePhotoActions(): void {
    photoActions.hidden = !placingPhotos || !selectedPhoto();
    tools.setPhotoMode(placingPhotos, current.photos.length > 0);
    for (const button of [shrinkPhoto, enlargePhoto, removePhoto]) {
      button.disabled = !!drag;
    }
  }

  function setPlacingPhotos(placing: boolean): void {
    placingPhotos = placing;
    if (!placing) selectedId = undefined;
    drawing.canvas.classList.toggle("ink-canvas--placing", placing);
    cancelPhotoDrag();
    updatePhotoStatus();
  }

  function updatePhotoStatus(): void {
    status.textContent = placingPhotos ? `摆放模式 · 已贴 ${current.photos.length} 张照片` : "";
  }

  function showPage(next: DiaryPage): void {
    manualSave.changed();
    current = next;
    draft = next;
    date.dateTime = next.recordDate;
    date.textContent = next.recordDate;
    autosave.schedule(next);
    drawing.replaceStrokes(next.strokes);
    tools.setUndoAvailable(history.length > 0);
    updatePhotoActions();
  }

  function commit(next: DiaryPage): void {
    history.push(current);
    showPage(next);
  }

  async function importSelection(): Promise<void> {
    const files = Array.from(picker.files ?? []);
    if (!files.length || importing) return;
    importing = true;
    back.disabled = true;
    menuButton.disabled = true;
    setMenuOpen(false);
    tools.setPhotoBusy(true);
    status.textContent = "正在准备照片…";
    try {
      const draftBytes = current.photos.reduce((total, placement) => {
        if (savedAssetIds.has(placement.assetId)) return total;
        const asset = assets.get(placement.assetId);
        return asset
          ? total + asset.original.size + (asset.preview?.size ?? 0)
          : total;
      }, 0);
      const imported = await preparePhotos(files, draftBytes);
      if (!panel.isConnected) return;
      let placements = imported.map((photo, index) =>
        placeImportedPhoto(photo, current.photos.length + index));
      let view = drawing.visiblePaper();
      const columns = imported.length <= 3 ? imported.length : Math.ceil(Math.sqrt(imported.length));
      if (view.width / columns < 72 || view.height < 72) {
        drawing.resetViewport();
        view = drawing.visiblePaper();
      }
      placements = arrangePhotosInView(placements, imported.map(({ image }) => image), view);
      for (const photo of imported) {
        images.set(photo.asset.id, photo.image);
        assets.set(photo.asset.id, photo.asset);
      }
      cancelPhotoDrag();
      selectedId = placements.at(-1)?.id;
      commit({ ...current, photos: [...current.photos, ...placements] });
      setPlacingPhotos(true);
    } catch (error) {
      if (!panel.isConnected) return;
      status.textContent = error instanceof DOMException && error.name === "QuotaExceededError"
        ? "空间不足，原有照片已保留。"
        : "这批照片无法打开，原有照片已保留。";
    } finally {
      picker.value = "";
      importing = false;
      back.disabled = false;
      menuButton.disabled = false;
      tools.setPhotoBusy(false);
    }
  }

  function loadInitialAssets(): Promise<readonly PhotoAsset[]> {
    return initialAssets ??= (async () => {
      if (!page.photos.length) return [];
      const saved = await store.getPage(page.id);
      if (!saved) throw new Error("Could not read the existing photo assets.");
      for (const asset of saved.photos) assets.set(asset.id, asset);
      if (page.photos.some(({ assetId }) => !assets.has(assetId))) {
        throw new Error("The saved page references a missing photo asset.");
      }
      return saved.photos;
    })().catch((error) => {
      initialAssets = undefined;
      throw error;
    });
  }

  async function saveSnapshot(snapshot: DiaryPage): Promise<void> {
    if (from === "calendar" && !snapshot.strokes.length && !snapshot.photos.length) {
      if (persisted) await store.deletePage(snapshot.id);
      persisted = false;
      savedAssetIds.clear();
      return;
    }

    // Keep original bytes in the session so undo can restore a removed asset.
    await loadInitialAssets();
    const nextAssetIds = new Set(snapshot.photos.map((photo) => photo.assetId));
    const newAssets: PhotoAsset[] = [];
    for (const id of nextAssetIds) {
      if (savedAssetIds.has(id)) continue;
      const asset = assets.get(id);
      if (!asset) throw new Error("Could not save a missing photo asset.");
      newAssets.push(asset);
    }
    const thumbnail = await createPageThumbnail(snapshot, assets, images).catch(() => undefined);
    await store.savePage(snapshot, newAssets, thumbnail);
    persisted = true;
    savedAssetIds = nextAssetIds;
  }

  async function leaveEditor(): Promise<void> {
    if (leaving || !panel.isConnected) return;
    if (importing || drag || drawing.isInteracting()) {
      showManualSave("blocked");
      return;
    }
    leaving = true;
    showManualSave("saving");
    panel.inert = true;
    try {
      const saved = await autosave.flush();
      if (!saved) {
        showManualSave("failed");
        return;
      }
      if (from === "reading") readingPage = current;
      draft = undefined;
      window.clearTimeout(saveFeedbackTimer);
      render(from);
    } catch {
      showManualSave("failed");
    } finally {
      panel.inert = false;
      leaving = false;
      if (panel.isConnected && manualState === "failed") retry.focus();
    }
  }

  async function loadExistingPhotos(): Promise<void> {
    try {
      for (const asset of await loadInitialAssets()) {
        if (!panel.isConnected) return;
        const image = await decodePhoto(asset.preview ?? asset.original);
        if (!panel.isConnected) return;
        images.set(asset.id, image);
      }
    } catch {
      if (panel.isConnected && !importing) status.textContent = "部分已贴照片无法打开。";
    } finally {
      if (panel.isConnected) drawing.replaceStrokes(current.strokes);
    }
  }

  picker.addEventListener("change", () => { void importSelection(); });
  const photoWorkspace = document.createElement("div");
  photoWorkspace.className = "photo-workspace";
  const paperViewport = document.createElement("div");
  paperViewport.className = "paper-viewport paper-viewport--editing";
  paperViewport.append(drawing.canvas);
  photoWorkspace.append(paperViewport, photoActions, status);
  panel.append(navigation, dateForm, editorMenu, tools.element, photoWorkspace,
    picker, deleteDialog);
  updatePhotoActions();
  if (page.photos.length) void loadExistingPhotos();
}

function render(view: View): void {
  stopFittingPaper?.();
  stopFittingPaper = undefined;
  clearSelectedThumbnail();
  stopTrackingToday?.();
  stopTrackingToday = undefined;
  releaseCalendarPreviews?.();
  releaseCalendarPreviews = undefined;
  const panel = document.createElement("section");
  const heading = document.createElement("h1");
  heading.tabIndex = -1;
  panel.append(heading);

  switch (view) {
    case "cover":
      heading.textContent = appTitle;
      heading.className = "visually-hidden";
      panel.className = "cover-screen";
      panel.append(...createCover(openBook));
      break;
    case "calendar":
      mountCalendar(panel, heading);
      break;
    case "reading":
      heading.textContent = "阅读";
      heading.className = "visually-hidden";
      panel.classList.add("diary-page-screen");
      if (readingPage) {
        mountReadingPage(panel, recordDateElement(readingPage.recordDate), readingPage, store,
          (page) => { readingPage = page; });
      }
      const readingTopbar = document.createElement("header");
      readingTopbar.className = "page-topbar";
      const returnToCalendar = action("‹", () => render("calendar"));
      returnToCalendar.setAttribute("aria-label", "返回月历");
      const readingActions = document.createElement("div");
      readingActions.className = "page-topbar-actions";
      const addForDay = action("＋", () => {
        if (readingPage) openNewPageForDate(readingPage.recordDate);
      });
      addForDay.setAttribute("aria-label", "为这一天添一页");
      readingActions.append(action("整页", () => resetPaperViewport(panel)), action("编辑此页", () => openEditor("reading")), addForDay);
      const readingDate = panel.querySelector("time");
      readingTopbar.append(returnToCalendar);
      if (readingDate) readingTopbar.append(readingDate);
      readingTopbar.append(readingActions);
      heading.after(readingTopbar);
      break;
    case "editing": {
      heading.textContent = "编辑";
      heading.className = "visually-hidden";
      panel.classList.add("diary-page-screen");
      if (draft) mountEditor(panel, draft, editingFrom);
      break;
    }
  }

  app.replaceChildren(panel);
  heading.focus({ preventScroll: true });
  if (view === "reading" || view === "editing") {
    window.scrollTo(0, 0);
    stopFittingPaper = fitPaperToScreen(panel);
  }
  const calendar = panel.querySelector("table");
  if (calendar) stopTrackingToday = trackCalendarToday(calendar);
  setUpdateEditingState(view === "editing");
}

render("cover");
