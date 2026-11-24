export function installAppUpdates(): (editing: boolean) => void {
  if (!import.meta.env.PROD) return () => {};

  const offlineStatus = document.createElement("p");
  offlineStatus.className = "app-offline-status";
  offlineStatus.setAttribute("role", "status");
  document.body.append(offlineStatus);
  if (!("serviceWorker" in navigator)) {
    offlineStatus.textContent = "当前环境无法准备离线使用";
    return (editing) => { offlineStatus.hidden = editing; };
  }
  const preparationLabel = document.createElement("span");
  preparationLabel.textContent = "正在准备离线使用…";
  offlineStatus.append(preparationLabel);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "重试离线准备";
  retry.hidden = true;
  offlineStatus.append(retry);

  const workers = navigator.serviceWorker;
  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.textContent = "更新应用";
  updateButton.className = "app-update-button";
  updateButton.hidden = true;
  document.body.append(updateButton);

  let registration: ServiceWorkerRegistration | undefined;
  let editing = false;
  let requestedWorker: ServiceWorker | undefined;
  let reloading = false;

  let preparationTimer: number | undefined;

  function showPreparation(message: string, failed = false): void {
    preparationLabel.textContent = message;
    retry.hidden = !failed;
  }

  function refreshControls(): void {
    if (workers.controller?.state === "activated") {
      window.clearTimeout(preparationTimer);
      showPreparation("离线已就绪");
    }
    if (!editing && requestedWorker && workers.controller === requestedWorker && !reloading) {
      reloading = true;
      window.location.reload();
      return;
    }
    updateButton.hidden = editing || !workers.controller || !registration?.waiting;
  }

  function watchInstallingWorker(): void {
    const installing = registration?.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "redundant" && !workers.controller) {
        window.clearTimeout(preparationTimer);
        showPreparation("离线准备失败，请联网重试", true);
      } else refreshControls();
    });
  }

  function checkForUpdate(): void {
    if (document.visibilityState === "visible") {
      void registration?.update().catch(() => {});
    }
  }

  updateButton.addEventListener("click", () => {
    if (editing || !registration?.waiting) return;
    requestedWorker = registration.waiting;
    requestedWorker.postMessage({ type: "SKIP_WAITING" });
  });
  workers.addEventListener("controllerchange", refreshControls);
  document.addEventListener("visibilitychange", checkForUpdate);
  window.addEventListener("online", checkForUpdate);
  async function prepareOffline(): Promise<void> {
    retry.disabled = true;
    showPreparation("正在准备离线使用…");
    window.clearTimeout(preparationTimer);
    preparationTimer = window.setTimeout(() => {
      if (!workers.controller) showPreparation("离线尚未就绪，请检查网络后重试", true);
    }, 15000);
    try {
      registration = await workers.register(`${import.meta.env.BASE_URL}sw.js`);
      registration.addEventListener("updatefound", watchInstallingWorker);
      watchInstallingWorker();
      refreshControls();
      checkForUpdate();
    } catch {
      window.clearTimeout(preparationTimer);
      if (workers.controller) refreshControls();
      else showPreparation("离线准备失败，请联网重试", true);
    } finally {
      retry.disabled = false;
    }
  }
  retry.addEventListener("click", () => { void prepareOffline(); });
  void prepareOffline();

  return (isEditing) => {
    editing = isEditing;
    offlineStatus.hidden = editing;
    refreshControls();
  };
}
