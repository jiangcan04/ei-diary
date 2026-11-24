import { exportBackup } from "./backup-export";
import { mountBackupRestore } from "./backup-restore-controls";
import { getDiaryDate } from "./diary-page";
import type { DiaryStore } from "./diary-store";

export function createBackupMenu(
  store: Pick<DiaryStore, "getBackupSnapshot" | "restoreBackup">,
  onRestored: () => void,
): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "calendar-backup-menu";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "calendar-icon calendar-backup-toggle";
  toggle.setAttribute("aria-label", "日记本菜单");
  toggle.setAttribute("aria-controls", "backup-actions");
  toggle.setAttribute("aria-expanded", "false");

  const actions = document.createElement("div");
  actions.id = "backup-actions";
  actions.className = "calendar-backup-actions";
  actions.hidden = true;
  toggle.addEventListener("click", () => {
    actions.hidden = !actions.hidden;
    toggle.setAttribute("aria-expanded", String(!actions.hidden));
  });
  const prepare = document.createElement("button");
  prepare.type = "button";
  prepare.textContent = "导出备份";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const save = document.createElement("button");
  save.type = "button";
  save.hidden = true;
  let download: File | undefined;
  let canShareFile = false;

  prepare.addEventListener("click", async () => {
    prepare.disabled = true;
    save.hidden = true;
    download = undefined;
    status.textContent = "正在准备备份…";
    try {
      const snapshot = await store.getBackupSnapshot();
      const zip = await exportBackup(snapshot);
      if (!menu.isConnected) return;
      download = new File([zip], `ei ？-备份-${getDiaryDate(new Date())}.zip`, { type: zip.type });
      canShareFile = typeof navigator.share === "function"
        && navigator.canShare?.({ files: [download] }) === true;
      save.textContent = canShareFile ? "存到文件" : "下载 ZIP";
      status.textContent = `备份已准备好，共 ${snapshot.length} 页。`;
      save.hidden = false;
    } catch {
      status.textContent = "没能导出备份，请再试一次。";
    } finally {
      prepare.disabled = false;
    }
  });

  save.addEventListener("click", () => {
    if (!download) return;
    if (canShareFile) {
      save.disabled = true;
      void navigator.share({ files: [download] }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        canShareFile = false;
        save.textContent = "下载 ZIP";
        status.textContent = "未能打开分享菜单，可以下载 ZIP。";
      }).finally(() => { save.disabled = false; });
      return;
    }
    const url = URL.createObjectURL(download);
    const link = document.createElement("a");
    link.href = url;
    link.download = download.name;
    menu.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });

  actions.append(prepare, status, save);
  mountBackupRestore(actions, store, onRestored);
  menu.append(toggle, actions);
  return menu;
}
