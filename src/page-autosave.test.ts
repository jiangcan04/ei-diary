import { expect, test, vi } from "vitest";
import { createPageAutosave } from "./page-autosave";

test("flush waits for the older write and saves the latest edit afterward", async () => {
  const written: number[] = [];
  let finishFirst = () => {};
  const delay = new Promise<void>((resolve) => { finishFirst = resolve; });
  const write = vi.fn(async (snapshot: number) => {
    if (snapshot === 1) await delay;
    written.push(snapshot);
  });
  const autosave = createPageAutosave(write, vi.fn());
  autosave.schedule(1);
  autosave.schedule(2);
  autosave.schedule(3);
  const flush = autosave.flush();

  expect(write.mock.calls).toEqual([[1]]);
  expect(written).toEqual([]);
  finishFirst();
  await expect(flush).resolves.toBe(true);
  expect(written).toEqual([1, 3]);
});

test("a failed write keeps the latest edit and waits for an explicit retry", async () => {
  const write = vi.fn<(snapshot: number) => Promise<void>>()
    .mockRejectedValueOnce(new Error("Storage full"))
    .mockResolvedValue(undefined);
  const showFailure = vi.fn();
  const autosave = createPageAutosave(write, showFailure);
  autosave.schedule(1);
  await expect(autosave.flush()).resolves.toBe(false);
  autosave.schedule(2);
  await expect(autosave.flush()).resolves.toBe(false);
  expect(write.mock.calls).toEqual([[1]]);

  autosave.retry();
  await expect(autosave.flush()).resolves.toBe(true);
  expect(write.mock.calls).toEqual([[1], [2]]);
  expect(showFailure.mock.calls).toEqual([[true], [false]]);
});
