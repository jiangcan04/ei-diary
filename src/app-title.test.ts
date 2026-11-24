import { expect, test } from "vitest";
import { appTitle } from "./app-title";

test("uses the product name with one ASCII space before its full-width question mark", () => {
  expect(appTitle).toBe("ei ？");
});
