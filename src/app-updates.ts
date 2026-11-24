export function installAppUpdates(): (editing: boolean) => void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return () => {};

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

  function refreshControls(): void {
    if (!editing && requestedWorker && workers.controller === requestedWorker && !reloading) {
      reloading = true;
      window.location.reload();
      return;
    }
    updateButton.hidden = editing || !workers.controller || !registration?.waiting;
  }

  function watchInstallingWorker(): void {
    registration?.installing?.addEventListener("statechange", refreshControls);
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
  void workers.getRegistration().then((existing) =>
    existing ?? workers.register(`${import.meta.env.BASE_URL}sw.js`)
  ).then((registered) => {
    registration = registered;
    registered.addEventListener("updatefound", watchInstallingWorker);
    watchInstallingWorker();
    refreshControls();
    checkForUpdate();
  }).catch(() => {
    // The app can still be used online when registration is unavailable.
  });

  return (isEditing) => {
    editing = isEditing;
    refreshControls();
  };
}
