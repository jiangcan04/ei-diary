import { expect, test, vi } from "vitest";
import { createManualSave, type ManualSaveState } from "./manual-save";
import { createPageAutosave } from "./page-autosave";

test("manual confirmation waits for slow autosave and subsequent edits, ignoring repeat requests", async () => {
  let snapshot = { version: 1 };
  let release = () => {};
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let concurrent = 0;
  let maximum = 0;
  const written: number[] = [];
  const queue = createPageAutosave(async (page: typeof snapshot) => {
    concurrent++;
    maximum = Math.max(maximum, concurrent);
    if (!written.length) await delayed;
    written.push(page.version);
    concurrent--;
  }, vi.fn());
  const states: ManualSaveState[] = [];
  const manual = createManualSave({
    snapshot: () => snapshot, isEmptyNewPage: () => false, isInteracting: () => false,
    schedule: queue.schedule, flush: queue.flush,
  }, (state) => states.push(state));
  queue.schedule(snapshot);
  const saved = manual.save();
  await manual.save();
  snapshot = { version: 2 };
  queue.schedule(snapshot);
  manual.changed();
  expect(states).toEqual(["saving"]);
  release();
  await saved;
  expect(states).toEqual(["saving", "saved"]);
  expect(written.at(-1)).toBe(2);
  expect(maximum).toBe(1);
  snapshot = { version: 3 };
  manual.changed();
  expect(states.at(-1)).toBe("idle");
});

test("empty drafts and active drawing cannot report saved or schedule partial content", async () => {
  let empty = true;
  let interacting = false;
  const schedule = vi.fn();
  const flush = vi.fn(async () => true);
  const show = vi.fn();
  const manual = createManualSave({
    snapshot: () => 1, isEmptyNewPage: () => empty, isInteracting: () => interacting,
    schedule, flush,
  }, show);
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("empty");
  empty = false;
  interacting = true;
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("blocked");
  expect(schedule).not.toHaveBeenCalled();
  expect(flush).not.toHaveBeenCalled();
});

test("failed writes never announce success, and an unfinished new gesture blocks confirmation", async () => {
  const show = vi.fn();
  let interacting = false;
  let success = false;
  const manual = createManualSave({
    snapshot: () => 1, isEmptyNewPage: () => false, isInteracting: () => interacting,
    schedule: vi.fn(), flush: async () => { interacting = true; return success; },
  }, show);
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("failed");
  interacting = false;
  success = true;
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("blocked");
  expect(show.mock.calls.flat()).not.toContain("saved");
});


test("manual and legacy retry share the failed queue and keep the latest draft", async () => {
  let snapshot = 1;
  let fail = true;
  const written: number[] = [];
  const queue = createPageAutosave(async (value: number) => {
    if (fail) throw new Error("Storage full");
    written.push(value);
  }, vi.fn());
  const show = vi.fn();
  const manual = createManualSave({
    snapshot: () => snapshot, isEmptyNewPage: () => false, isInteracting: () => false,
    schedule: queue.schedule, flush: queue.flush, retry: queue.retry,
  }, show);
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("failed");
  snapshot = 2;
  queue.schedule(snapshot);
  fail = false;
  await manual.save();
  expect(show).toHaveBeenLastCalledWith("saved");
  expect(written).toEqual([2]);
  expect(await queue.flush()).toBe(true);
});
