import { readBackup } from "./backup-import";
import type { DiaryStore, StoredDiaryPage } from "./diary-store";

export function mountBackupRestore(
  actions: HTMLElement, store: Pick<DiaryStore, "restoreBackup">, onRestored: () => void,
): void {
  const choose = document.createElement("button");
  choose.type = "button";
  choose.textContent = "从备份恢复";
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".zip,application/zip";
  picker.hidden = true;
  const status = document.createElement("p");
  status.setAttribute("role", "status");

  const dialog = document.createElement("dialog");
  dialog.className = "backup-restore-dialog";
  const title = document.createElement("h2");
  title.textContent = "恢复备份？";
  title.id = "backup-restore-title";
  dialog.setAttribute("aria-labelledby", title.id);
  const summary = document.createElement("p");
  const error = document.createElement("p");
  error.setAttribute("role", "status");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消恢复";
  cancel.autofocus = true;
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.textContent = "确认恢复";
  dialog.append(title, summary, error, cancel, confirm);
  actions.append(choose, status, picker, dialog);

  let staged: readonly StoredDiaryPage[] | undefined;
  choose.addEventListener("click", () => picker.click());
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (!file) return;
    choose.disabled = true;
    status.textContent = "正在检查备份…";
    try {
      const pages = await readBackup(file);
      if (!dialog.isConnected) return;
      staged = pages;
      status.textContent = "";
      error.textContent = "";
      summary.textContent = `备份包含 ${pages.length} 页。已有的页面会保留本机版本。`;
      dialog.showModal();
    } catch {
      status.textContent = "无法读取备份。请选择完整的「ei ？」ZIP 备份。";
    } finally {
      choose.disabled = false;
    }
  });
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (confirm.disabled) event.preventDefault();
  });
  dialog.addEventListener("close", () => { staged = undefined; });
  confirm.addEventListener("click", async () => {
    if (!staged) return;
    const snapshot = staged;
    confirm.disabled = cancel.disabled = true;
    error.textContent = "";
    try {
      const added = await store.restoreBackup(snapshot);
      status.textContent = `已恢复 ${added} 页，保留本机已有的 ${snapshot.length - added} 页。`;
      dialog.close();
      if (added) onRestored();
    } catch {
      error.textContent = "没能恢复备份，原有日记已保留。请重试。";
    } finally {
      confirm.disabled = cancel.disabled = false;
    }
  });
}
