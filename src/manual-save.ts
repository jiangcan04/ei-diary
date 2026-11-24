export type ManualSaveState = "idle" | "saving" | "saved" | "empty" | "blocked" | "failed";

/** Manual confirmation shares the editor's serial autosave queue. */
export function createManualSave<T>(
  options: {
    snapshot: () => T;
    isEmptyNewPage: () => boolean;
    isInteracting: () => boolean;
    schedule: (snapshot: T) => void;
    flush: () => Promise<boolean>;
    retry?: () => void;
  },
  show: (state: ManualSaveState) => void,
) {
  let busy = false;
  return {
    changed(): void {
      if (!busy) show("idle");
    },
    async save(): Promise<void> {
      if (busy) return;
      if (options.isInteracting()) { show("blocked"); return; }
      if (options.isEmptyNewPage()) { show("empty"); return; }
      busy = true;
      show("saving");
      try {
        let snapshot: T;
        do {
          snapshot = options.snapshot();
          options.schedule(snapshot);
          options.retry?.();
          if (!await options.flush()) { show("failed"); return; }
        } while (snapshot !== options.snapshot());
        show(options.isInteracting() ? "blocked" : "saved");
      } catch {
        show("failed");
      } finally {
        busy = false;
      }
    },
  };
}
