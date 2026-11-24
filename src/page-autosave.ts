export function createPageAutosave<T>(
  write: (snapshot: T) => Promise<void>,
  setFailed: (failed: boolean) => void,
) {
  let pending: { snapshot: T } | undefined;
  let saving: Promise<void> | undefined;
  let failed = false;

  async function drain(): Promise<void> {
    while (pending) {
      const job = pending;
      pending = undefined;
      try {
        await write(job.snapshot);
      } catch {
        // Keep a newer edit if one arrived while this write was in flight.
        pending ??= job;
        failed = true;
        setFailed(true);
        break;
      }
    }
  }

  function start(): void {
    if (saving || !pending || failed) return;
    saving = drain().finally(() => {
      saving = undefined;
      start();
    });
  }

  return {
    schedule(snapshot: T): void {
      pending = { snapshot };
      start();
    },
    async flush(): Promise<boolean> {
      while (saving) await saving;
      return !failed;
    },
    retry(): void {
      if (!failed) return;
      failed = false;
      setFailed(false);
      start();
    },
  };
}
