import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { devices, webkit } from "playwright";
import { preview } from "vite";

function calendarOrButton(page, name) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
    return page.locator("td").filter({
      has: page.locator(`time[datetime="${name}"]`),
    }).locator("button:visible");
  }
  return page.getByRole("button", { name, exact: true });
}

async function checkPreviewBoundaries(page) {
  const results = await page.locator(".calendar-preview").evaluateAll((buttons) => buttons.map((button) => {
    const cell = button.closest("td").getBoundingClientRect();
    const box = button.getBoundingClientRect();
    const content = button.querySelector(".calendar-preview-content");
    const image = content?.querySelector("img");
    const imageBox = image?.getBoundingClientRect();
    const style = getComputedStyle(button);
    const layers = ["::before", "::after"].map((pseudo) => {
      const layer = getComputedStyle(button, pseudo);
      return {
        visible: layer.content !== "none" && layer.content !== "normal",
        inside: [layer.top, layer.right, layer.bottom, layer.left]
          .every((value) => Number.isFinite(parseFloat(value)) && parseFloat(value) >= 0),
      };
    });
    const stacked = button.classList.contains("calendar-preview--stacked");
    const today = button.classList.contains("calendar-preview--today");
    return {
      label: button.getAttribute("aria-label"),
      unified: button.querySelectorAll("img").length === 1 && image && getComputedStyle(image).objectFit === "contain",
      layers: stacked ? layers.every((layer) => layer.visible && layer.inside)
        && style.boxShadow === "none" : layers.every((layer) => !layer.visible),
      today: !today || (parseFloat(style.outlineWidth) === 2 && parseFloat(style.outlineOffset) <= -2),
      inset: box.left - cell.left >= 4 && cell.right - box.right >= 4
        && box.top - cell.top >= 4 && cell.bottom - box.bottom >= 4,
      clipped: getComputedStyle(button.closest("td")).overflow === "hidden"
        && content && getComputedStyle(content).overflow === "hidden",
      contained: imageBox && imageBox.width > 0 && imageBox.height > 0
        && imageBox.left >= box.left - 1 && imageBox.right <= box.right + 1
        && imageBox.top >= box.top - 1 && imageBox.bottom <= box.bottom + 1,
    };
  }));
  assert.ok(results.length > 0, "Boundary checks must include actual works.");
  for (const result of results) {
    assert.ok(result.inset && result.clipped && result.contained
      && result.unified && result.layers && result.today,
      `Preview must remain inside its date cell: ${JSON.stringify(result)}`);
  }
}

test("the production build starts and preserves calendar navigation in iPhone WebKit", { timeout: 60_000 }, async (t) => {
  const server = await preview({
    preview: { host: "127.0.0.1", port: 0 },
  });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));

  const browser = await webkit.launch();
  t.after(() => browser.close());

  const page = await browser.newPage({ ...devices["iPhone 13"], timezoneId: "Asia/Shanghai" });
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const { port } = server.httpServer.address();
  const response = await page.goto("http://127.0.0.1:" + port);
  assert.ok(response?.ok(), "Preview should respond successfully.");

  const heading = page.getByRole("heading", { name: "ei ？", exact: true });
  await heading.waitFor({ state: "visible" });
  assert.equal(await page.title(), "ei ？");
  const installation = await page.evaluate(async () => {
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error("The web app manifest could not be loaded.");
    const manifest = await response.json();
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    const icons = [
      [appleIcon.href, appleIcon.sizes.value],
      ...manifest.icons.map(({ src, sizes }) => [new URL(src, manifestUrl).href, sizes]),
    ];
    for (const [src, dimensions] of icons) {
      const image = new Image();
      image.src = src;
      await image.decode();
      if (`${image.naturalWidth}x${image.naturalHeight}` !== dimensions) {
        throw new Error(`Unexpected installation icon dimensions for ${src}`);
      }
    }
    return {
      name: manifest.name,
      display: manifest.display,
      start: new URL(manifest.start_url, manifestUrl).href,
      scope: new URL(manifest.scope, manifestUrl).href,
      sizes: icons.map(([, sizes]) => sizes),
    };
  });
  assert.deepEqual(installation, {
    name: "ei ？",
    display: "standalone",
    start: new URL("/", page.url()).href,
    scope: new URL("/", page.url()).href,
    sizes: ["180x180", "192x192", "512x512"],
  });
  assert.equal(await page.evaluate(() => innerWidth), devices["iPhone 13"].viewport.width);
  const click = (name) => calendarOrButton(page, name).click();
  const see = (name) => page.getByRole("heading", { name, exact: true }).waitFor();

  const book = page.getByRole("button", { name: "打开日记本", exact: true });
  const dates = page.locator("main time");
  assert.equal(await dates.count(), 1);
  assert.equal(await dates.textContent(), "11月18日");
  assert.equal(await book.textContent(), "");
  const cover = await book.boundingBox();
  const screen = await page.locator("main").boundingBox();
  assert.ok(cover && screen);
  const areaRatio = cover.width * cover.height / (screen.width * screen.height);
  assert.ok(areaRatio >= 0.09 && areaRatio <= 0.13, `Unexpected cover area: ${areaRatio}`);
  assert.ok(Math.abs(cover.x + cover.width / 2 - screen.width / 2) < 2);
  assert.ok(Math.abs(cover.y + cover.height / 2 - screen.height / 2) < 2);

  await book.click();
  await see("2026年11月");
  const localFontLoaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px "Diary Hand"', "2026年11月恢复备份颜色粗细");
    return faces.some((face) => face.status === "loaded");
  });
  assert.ok(localFontLoaded);
  const handFontUsed = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const sample = "2026年11月恢复备份颜色粗细";
    context.font = '32px "Diary Hand", monospace';
    const handwritten = context.measureText(sample).width;
    context.font = "32px monospace";
    const fallback = context.measureText(sample).width;
    const input = document.createElement("input");
    document.body.append(input);
    const inherited = getComputedStyle(input).fontFamily.includes("Diary Hand");
    input.remove();
    return Math.abs(handwritten - fallback) > 1 && inherited;
  });
  assert.ok(handFontUsed, "The local font should draw interface text and be inherited by inputs.");

  const checkCalendarSize = async (weeks) => {
    const layout = await page.locator(".calendar-screen").evaluate((panel) => {
      const scene = panel.querySelector(".calendar-scene").getBoundingClientRect();
      const paper = panel.querySelector(".calendar-paper").getBoundingClientRect();
      const table = panel.querySelector("table").getBoundingClientRect();
      const rows = Array.from(panel.querySelectorAll("tbody tr"), (row) => row.getBoundingClientRect().height);
      return {
        width: panel.getBoundingClientRect().width, viewportWidth: innerWidth,
        heightRatio: scene.height / innerHeight, rows,
        contained: table.left >= paper.left && table.right <= paper.right + 1 && table.bottom <= paper.bottom + 1,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(layout.rows.length, weeks);
    assert.ok(layout.heightRatio >= 0.68 && layout.heightRatio <= 0.72);
    assert.ok(layout.width <= 832 && !layout.overflow && layout.contained);
    if (layout.viewportWidth < 800) {
      assert.ok(layout.width / layout.viewportWidth >= 0.92 && layout.width / layout.viewportWidth <= 0.96);
    }
    assert.ok(Math.max(...layout.rows) - Math.min(...layout.rows) < 2);
    assert.ok(Math.min(...layout.rows) > 20);
  };
  await checkCalendarSize(6);
  for (const viewport of [{ width: 320, height: 700 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await checkCalendarSize(6);
  }
  await page.setViewportSize(devices["iPhone 13"].viewport);
  const sceneBeforeMenu = await page.locator(".calendar-scene").boundingBox();
  await page.locator(".calendar-backup-toggle").click();
  assert.deepEqual(await page.locator(".calendar-scene").boundingBox(), sceneBeforeMenu);
  await page.locator(".calendar-backup-toggle").click();
  assert.deepEqual(await page.locator(".calendar-scene").boundingBox(), sceneBeforeMenu);

  const paper = page.locator(".calendar-paper");
  const shade = page.locator(".lamp-shade");
  const base = page.locator(".lamp-base");
  const paperBox = await paper.boundingBox();
  const shadeBox = await shade.boundingBox();
  const baseBox = await base.boundingBox();
  assert.ok(paperBox && shadeBox && baseBox);
  assert.ok(shadeBox.y + shadeBox.height <= paperBox.y);
  assert.ok(baseBox.y >= paperBox.y + paperBox.height);
  assert.ok(paperBox.x >= 0 && paperBox.x + paperBox.width <= devices["iPhone 13"].viewport.width);
  assert.ok(await paper.getByRole("table").isVisible());
  for (const name of ["添一页", "合上日记本"]) {
    const button = page.getByRole("button", { name, exact: true });
    const bounds = await button.boundingBox();
    assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44);
  }

  await click("上个月");
  await see("2026年10月");
  await checkCalendarSize(5);
  const recordDate = () => page.locator("main > section time").getAttribute("datetime");
  await click("添一页");
  await see("编辑");
  const editingLayout = await page.locator("main > section").evaluate((panel) => {
    const heading = panel.querySelector("h1").getBoundingClientRect();
    const topbar = panel.querySelector(".page-topbar").getBoundingClientRect();
    const paper = panel.querySelector(".ink-canvas").getBoundingClientRect();
    return heading.width <= 1 && heading.height <= 1 && topbar.bottom <= paper.top;
  });
  assert.ok(editingLayout, "The editor should have a compact topbar and an accessible hidden heading.");

  assert.equal(await recordDate(), "2026-11-18");
  await click("返回");
  await see("2026年10月");

  await click("2026-10-10");
  await see("编辑");
  assert.equal(await recordDate(), "2026-10-10");
  await click("返回");
  await see("2026年10月");

  // The date tap has opened the app database. Seed one existing page for this test only.
  const emptyCount = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("ei-ni-kan");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pages", "readwrite");
      const pages = tx.objectStore("pages");
      const count = pages.count();
      pages.put({
        id: "existing-fixture", recordDate: "2026-10-12", createdAt: 1,
        strokes: [{ points: [{ x: 5, y: 8 }], color: "#252322", width: 2 }], photos: [],
      });
      tx.oncomplete = () => { db.close(); resolve(count.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  assert.equal(emptyCount, 0);

  await click("2026-10-12");
  await click("为这一天添一页");
  await see("编辑");
  assert.equal(await recordDate(), "2026-10-12");
  await click("返回");
  await see("2026年10月");
  await click("2026-10-12");
  await see("阅读");
  const readingTopbar = page.locator(".page-topbar");
  assert.ok(await readingTopbar.getByRole("button", { name: "返回月历", exact: true }).isVisible());
  await readingTopbar.getByRole("button", { name: "为这一天添一页", exact: true }).click();
  await see("编辑");
  assert.equal(await recordDate(), "2026-10-12");
  await click("返回");
  await see("2026年10月");
  await click("2026-10-12");
  await see("阅读");

  assert.equal(await recordDate(), "2026-10-12");
  await click("编辑此页");
  await see("编辑");
  await click("返回");
  await see("阅读");
  await click("返回月历");
  await see("2026年10月");

  const savedCount = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("ei-ni-kan");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const count = db.transaction("pages").objectStore("pages").count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => { db.close(); reject(count.error); };
    };
  }));
  assert.equal(savedCount, 1);

  await click("合上日记本");
  await see("ei ？");
  await book.click({ position: { x: cover.width - 5, y: cover.height / 2 } });
  await see("2026年11月");
  const calendar = page.getByRole("table");
  assert.deepEqual(await calendar.getByRole("columnheader").allTextContents(),
    ["一", "二", "三", "四", "五", "六", "日"]);
  const column = (date) => calendar.locator(`time[datetime="${date}"]`)
    .evaluate((element) => element.closest("td").cellIndex);
  assert.equal(await column("2026-11-01"), 6);
  assert.equal(await column("2026-11-30"), 0);

  const rollover = await browser.newPage({
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  await rollover.clock.install({ time: new Date("2023-12-31T17:59:00Z") });
  await rollover.goto("http://127.0.0.1:" + port);
  await rollover.getByRole("button", { name: "打开日记本" }).click();
  const today = rollover.locator('table [aria-current="date"]');
  assert.equal(await today.getAttribute("datetime"), "2023-12-31");
  await rollover.getByRole("button", { name: "下个月" }).click();
  await rollover.getByRole("heading", { name: "2024年1月" }).waitFor();
  assert.equal(await today.count(), 0);
  await rollover.clock.fastForward(60_000);
  await today.waitFor();
  assert.equal(await today.getAttribute("datetime"), "2024-01-01");
  await rollover.getByRole("button", { name: "下个月" }).click();
  await rollover.getByRole("heading", { name: "2024年2月" }).waitFor();
  assert.equal(await rollover.locator("table time").count(), 29);
  assert.equal(await rollover.locator("table time").last().getAttribute("datetime"), "2024-02-29");

  // WebKit rejects IndexedDB Blob writes in ephemeral contexts.
  // An empty profile path creates a fresh temporary persistent profile.
  const photoContext = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => photoContext.close());
  const fallback = photoContext.pages()[0] ?? await photoContext.newPage();
  await fallback.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  let fontBlocked = false;
  await fallback.route("**/fonts/long-cang-ui-v2.*", (route) => {
    fontBlocked = true;
    return route.abort();
  });
  await fallback.goto("http://127.0.0.1:" + port);
  await fallback.getByRole("button", { name: "打开日记本" }).click();
  const monthHeading = fallback.getByRole("heading", { name: /^\d+年\d+月$/ });
  await monthHeading.waitFor();
  assert.ok(await fallback.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector(".calendar-month-nav h1");
    return heading?.getBoundingClientRect().width > 0;
  }));
  assert.ok(fontBlocked);
  await fallback.getByRole("button", { name: "添一页", exact: true }).click();
  for (const name of ["画笔", "照片", "撤销"]) {
    const tool = fallback.getByRole("button", { name, exact: true });
    assert.ok(await tool.isVisible());
    assert.equal(await tool.isDisabled(), name === "撤销");
    assert.ok(await tool.locator(".tool-mark").isVisible());
  }
  const canvas = fallback.getByLabel("日记画纸", { exact: true });
  const centeredPaper = await fallback.locator(".paper-viewport").evaluate((viewport) => {
    const bounds = viewport.getBoundingClientRect();
    const paper = viewport.querySelector("canvas").getBoundingClientRect();
    return {
      complete: paper.left >= bounds.left && paper.right <= bounds.right + 1
        && paper.top >= bounds.top && paper.bottom <= bounds.bottom + 1,
      centered: Math.abs((paper.left + paper.right - bounds.left - bounds.right) / 2) < 2
        && Math.abs((paper.top + paper.bottom - bounds.top - bounds.bottom) / 2) < 2,
      ratio: paper.width / paper.height,
      overflow: viewport.scrollWidth > viewport.clientWidth + 1
        || viewport.scrollHeight > viewport.clientHeight + 1,
    };
  });
  assert.ok(centeredPaper.complete && centeredPaper.centered);
  assert.ok(Math.abs(centeredPaper.ratio - 0.75) < 0.01);
  assert.equal(centeredPaper.overflow, false);
  const toolbar = fallback.locator(".editor-toolbox");
  async function checkToolbar(expectedRows) {
    const result = await toolbar.evaluate((toolbar) => {
      const bounds = toolbar.getBoundingClientRect();
      const controls = [...toolbar.querySelectorAll("button, input[type=color]")];
      const tops = new Set(controls.map((control) => Math.round(control.getBoundingClientRect().top)));
      return {
        rows: tops.size,
        noOverflow: toolbar.scrollWidth <= toolbar.clientWidth + 1,
        visible: controls.every((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44
            && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
        }),
        abovePaper: bounds.bottom <= document.querySelector(".ink-canvas").getBoundingClientRect().top,
      };
    });
    assert.equal(result.rows, expectedRows);
    assert.ok(result.noOverflow && result.visible && result.abovePaper);
    const save = fallback.getByRole("button", { name: "保存", exact: true });
    assert.ok(await save.isVisible());
    assert.ok(await save.isEnabled(), "Manual saving should be available when not saving.");
    const navigation = await fallback.locator(".editor-topbar").evaluate((bar) => {
      const bounds = bar.getBoundingClientRect();
      const buttons = Array.from(bar.querySelectorAll("button"))
        .filter((button) => button.getClientRects().length > 0);
      const boxes = buttons.map((button) => button.getBoundingClientRect());
      const save = bar.querySelector(".editor-save-button");
      const paper = document.querySelector(".ink-canvas");
      const tools = document.querySelector(".editor-toolbox");
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return [value.x, value.y, value.width, value.height];
      };
      const baseline = JSON.stringify([rect(bar), rect(paper), rect(tools)]);
      const original = save.textContent;
      let stable = true;
      for (const text of ["保存中…", "已保存", "保存失败", "保存"]) {
        save.textContent = text;
        stable &&= JSON.stringify([rect(bar), rect(paper), rect(tools)]) === baseline;
      }
      save.textContent = original;
      return {
        stable,
        contained: boxes.every((box) => box.width >= 44 && box.height >= 44
          && box.left >= bounds.left - 1 && box.right <= bounds.right + 1
          && box.left >= 0 && box.right <= innerWidth),
        separated: boxes.every((box, index) => index === 0 || box.left >= boxes[index - 1].right - 1),
        above: bounds.bottom <= tools.getBoundingClientRect().top
          && tools.getBoundingClientRect().bottom <= paper.getBoundingClientRect().top,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(navigation.stable && navigation.contained && navigation.separated
      && navigation.above && !navigation.overflow, JSON.stringify(navigation));
  }
  await checkToolbar(2);
  const originalSize = fallback.viewportSize();
  await fallback.setViewportSize({ width: 320, height: 700 });
  await checkToolbar(3);
  await fallback.setViewportSize({ width: 844, height: 390 });
  await checkToolbar(2);
  await fallback.setViewportSize(originalSize);
  await checkToolbar(2);
  assert.equal(await fallback.getByRole("button", { name: "画笔", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await fallback.getByRole("button", { name: "整笔橡皮", exact: true }).getAttribute("aria-pressed"), "false");
  assert.ok(await fallback.getByRole("button", { name: "调整照片", exact: true }).isDisabled());
  assert.equal(await fallback.getByRole("button", { name: "笔画粗细", exact: true }).textContent(), "细笔");
  await toolbar.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  assert.equal(await toolbar.evaluate((element) => element.scrollLeft), 0);
  const noToolbarInk = await canvas.evaluate((surface) =>
    !surface.getContext("2d").getImageData(0, 0, surface.width, surface.height).data
      .some((value, index) => index % 4 === 3 && value > 0));
  assert.ok(noToolbarInk);
  async function toolAndPaperState() {
    return fallback.evaluate(() => {
      const canvas = document.querySelector(".ink-canvas");
      const rect = canvas.getBoundingClientRect();
      const context = canvas.getContext("2d");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
      const transform = context.getTransform();
      return {
        hash, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        transform: [transform.a, transform.d, transform.e, transform.f],
        scroll: [window.scrollX, window.scrollY],
        selected: [...document.querySelectorAll(".editor-toolbox [aria-pressed=true]")]
          .map((control) => control.getAttribute("aria-label")),
      };
    });
  }
  // Viewport resize notifications and the ResizeObserver fit run asynchronously in WebKit.
  // Establish the gesture baseline only after the restored layout has settled.
  await fallback.evaluate(async () => {
    let previous = "";
    let stableFrames = 0;
    for (let frame = 0; frame < 120; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = document.querySelector(".ink-canvas").getBoundingClientRect();
      const state = JSON.stringify([rect.x, rect.y, rect.width, rect.height,
        visualViewport?.width, visualViewport?.height]);
      stableFrames = state === previous ? stableFrames + 1 : 0;
      previous = state;
      if (stableFrames >= 4) return;
    }
    throw new Error("The paper did not settle after restoring the phone viewport.");
  });
  const beforeToolSwipe = await toolAndPaperState();
  const greenSwatch = fallback.getByRole("button", { name: "嫩绿", exact: true });
  const swatchBounds = await greenSwatch.boundingBox();
  const paperBounds = await canvas.boundingBox();
  assert.ok(swatchBounds && paperBounds);
  const start = { x: swatchBounds.x + swatchBounds.width / 2, y: swatchBounds.y + swatchBounds.height / 2 };
  for (const target of [
    { x: start.x + 90, y: start.y },
    { x: start.x, y: start.y - 25 },
    { x: paperBounds.x + paperBounds.width / 2, y: paperBounds.y + 80 },
  ]) {
    await fallback.mouse.move(start.x, start.y);
    await fallback.mouse.down();
    await fallback.mouse.move(target.x, target.y, { steps: 5 });
    await fallback.mouse.up();
    assert.deepEqual(await toolAndPaperState(), beforeToolSwipe);
  }
  // Moving out and returning to the same color must also suppress its click.
  await fallback.mouse.move(start.x, start.y);
  await fallback.mouse.down();
  await fallback.mouse.move(start.x + 50, start.y, { steps: 3 });
  await fallback.mouse.move(start.x, start.y, { steps: 3 });
  await fallback.mouse.up();
  assert.deepEqual(await toolAndPaperState(), beforeToolSwipe);

  const draw = async (points) => {
    await canvas.evaluate((surface, points) => {
      const box = surface.getBoundingClientRect();
      const capture = surface.setPointerCapture;
      surface.setPointerCapture = () => {};
      const send = (type, point) => surface.dispatchEvent(new PointerEvent(type, {
        pointerId: 17, pointerType: "pen", isPrimary: true,
        button: 0, buttons: type === "pointerup" ? 0 : 1,
        clientX: box.x + point[0] * box.width / 600,
        clientY: box.y + point[1] * box.height / 800,
      }));
      try {
        send("pointerdown", points[0]);
        for (const point of points.slice(1)) send("pointermove", point);
        send("pointerup", points.at(-1));
      } finally {
        surface.setPointerCapture = capture;
      }
    }, points);
  };
  const hasInk = (x, y) => canvas.evaluate((surface, [left, top]) => {
    const pixels = surface.getContext("2d").getImageData(left - 4, top - 4, 9, 9).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  }, [x, y]);

  await draw([[100, 130]]);
  await draw([[12, 240], [590, 240]]);
  await draw([[150, 370], [300, 370]]);
  await draw([[225, 370], [225, 500]]);
  assert.ok(await hasInk(100, 130), "A tap should leave a dot after lifting.");
  assert.ok(await hasInk(300, 240) && await hasInk(586, 240), "A line should reach the paper edge.");
  assert.ok(await hasInk(165, 370) && await hasInk(225, 480), "Handwritten strokes should remain visible.");
  await fallback.getByRole("heading", { name: "编辑", exact: true }).waitFor();

  const brushButton = fallback.getByRole("button", { name: "画笔", exact: true });
  const sampleStroke = (y) => canvas.evaluate((surface, center) => {
    const pixels = surface.getContext("2d").getImageData(350, center - 10, 1, 21).data;
    let width = 0;
    let color = null;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 240) continue;
      width++;
      color = "#" + Array.from(pixels.slice(index, index + 3))
        .map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    return { width, color };
  }, y);

  const originalInk = await sampleStroke(240);
  assert.equal(originalInk.color, "#252322");
  const palette = [
    ["嫩绿", "#b7cf82"], ["柔和绿", "#8da581"], ["苔绿", "#65784c"],
    ["深松绿", "#294c3b"], ["炭黑", "#252322"], ["白色", "#ffffff"],
  ];
  for (const [index, [name, color]] of palette.entries()) {
    await brushButton.click();
    const swatch = fallback.getByRole("button", { name, exact: true });
    await swatch.click();
    assert.equal(await swatch.getAttribute("aria-pressed"), "true");
    if (name === "白色") {
      assert.equal(await swatch.evaluate((button) => getComputedStyle(button, "::before").borderTopWidth), "1px");
    }
    await brushButton.click();
    const y = 550 + index * 25;
    await draw([[310, y], [400, y]]);
    assert.equal((await sampleStroke(y)).color, color);
    if (name === "白色") {
      const lightOnDark = await canvas.evaluate((surface, center) => {
        const preview = document.createElement("canvas");
        preview.width = surface.width;
        preview.height = surface.height;
        const ctx = preview.getContext("2d");
        ctx.fillStyle = "#182319";
        ctx.fillRect(0, 0, preview.width, preview.height);
        ctx.drawImage(surface, 0, 0);
        const ink = ctx.getImageData(350, center - 4, 1, 9).data;
        const background = ctx.getImageData(350, center + 12, 1, 1).data;
        const whiteVisible = ink.some((value, index) => index % 4 === 0
          && value > 180 && ink[index + 1] > 180 && ink[index + 2] > 180);
        return whiteVisible && background[0] === 24;
      }, y);
      assert.ok(lightOnDark, "White ink should remain visible over a dark layer.");
    }
  }

  await brushButton.click();
  await fallback.getByLabel("自选颜色", { exact: true }).fill("#813c58");
  await fallback.getByRole("button", { name: "笔画粗细", exact: true }).click();
  await brushButton.click();
  await draw([[310, 725], [400, 725]]);
  const thickInk = await sampleStroke(725);
  assert.equal(thickInk.color, "#813c58");
  assert.ok(thickInk.width > originalInk.width);
  assert.deepEqual(await sampleStroke(240), originalInk);
  await brushButton.click();
  await fallback.getByRole("button", { name: "笔画粗细", exact: true }).click();
  await brushButton.click();
  await draw([[310, 765], [400, 765]]);
  assert.ok((await sampleStroke(765)).width < thickInk.width);

  const undo = fallback.getByRole("button", { name: "撤销", exact: true });
  for (const y of [30, 65, 100]) await draw([[310, y], [400, y]]);
  assert.ok(await hasInk(350, 30) && await hasInk(350, 65) && await hasInk(350, 100));
  await undo.click();
  assert.ok(!(await hasInk(350, 100)), "Undo should remove the latest stroke.");
  await brushButton.click();
  await fallback.getByRole("button", { name: "整笔橡皮", exact: true }).click();
  await draw([[350, 65]]);
  assert.ok(!(await hasInk(315, 65)) && !(await hasInk(395, 65)), "The entire hit stroke should be erased.");
  assert.ok(await hasInk(350, 30));
  assert.deepEqual(await sampleStroke(240), originalInk);
  await undo.click();
  assert.ok(await hasInk(315, 65) && await hasInk(395, 65), "Undo should restore the erased stroke.");
  assert.ok(!(await hasInk(350, 100)), "Undoing erasure should not restore an earlier undone stroke.");

  const back = fallback.getByRole("button", { name: "返回", exact: true });
  await back.click();
  await monthHeading.waitFor();
  await fallback.getByRole("button", { name: "添一页", exact: true }).click();
  assert.ok(await undo.isDisabled(), "A fresh editing session should have no undo history.");
  const pinchResult = await canvas.evaluate((surface) => {
    const context = surface.getContext("2d");
    const rect = surface.getBoundingClientRect();
    // Synthetic pointers have no native capture; dispatch directly to the same target.
    surface.setPointerCapture = () => {};
    function touch(type, pointerId, x, y) {
      surface.dispatchEvent(new PointerEvent(`pointer${type}`, {
        pointerId,
        pointerType: "touch",
        button: type === "move" ? -1 : 0,
        buttons: type === "up" ? 0 : 1,
        clientX: rect.left + rect.width * x / surface.width,
        clientY: rect.top + rect.height * y / surface.height,
      }));
    }
    function hasInkNear(x, y) {
      return context.getImageData(x - 3, y - 3, 7, 7).data
        .some((value, index) => index % 4 === 3 && value > 0);
    }

    touch("down", 1, 180, 300);
    touch("up", 1, 180, 300);
    touch("down", 2, 100, 200);
    const firstContactVisible = hasInkNear(100, 200);
    touch("down", 3, 300, 400);
    const canceledOnSecondContact = !hasInkNear(100, 200);
    touch("move", 2, 0, 100);
    touch("move", 3, 400, 500);
    const zoomed = hasInkNear(160, 300) && !hasInkNear(180, 300);
    touch("move", 2, 30, 100);
    touch("move", 3, 430, 500);
    const panned = hasInkNear(190, 300) && !hasInkNear(160, 300);
    touch("up", 2, 30, 100);
    touch("move", 3, 450, 520);
    touch("up", 3, 450, 520);
    const lastFingerDidNotDraw = !hasInkNear(450, 520);

    touch("down", 4, 260, 400);
    touch("move", 4, 300, 400);
    touch("up", 4, 300, 400);
    const drewZoomed = hasInkNear(280, 400);

    touch("down", 5, 100, 100);
    touch("down", 6, 500, 500);
    touch("move", 5, 220, 220);
    touch("move", 6, 380, 380);
    touch("up", 5, 220, 220);
    touch("up", 6, 380, 380);

    return {
      firstContactVisible,
      canceledOnSecondContact,
      zoomed,
      panned,
      lastFingerDidNotDraw,
      drewZoomed,
      originalKeptPosition: hasInkNear(180, 300),
      newStrokeInPaperCoordinates: hasInkNear(225, 350),
      noExtraInk: !hasInkNear(100, 200) && !hasInkNear(100, 100),
    };
  });
  for (const [check, passed] of Object.entries(pinchResult)) assert.ok(passed, check);
  await back.click();
  await monthHeading.waitFor();
  // The calendar opens the latest page for the day. Give the collage a
  // later creation time than the earlier ink-only pages on the fixed clock.
  await fallback.clock.setFixedTime(new Date("2026-11-18T04:01:00Z"));
  await fallback.getByRole("button", { name: "添一页", exact: true }).click();

  const photoButton = fallback.getByRole("button", { name: "照片", exact: true });
  const notice = fallback.locator(".photo-status");
  const colors = ["#b32042", "#277348", "#344b9b", "#a56a32", "#683582"];
  const fixtures = await fallback.evaluate((swatches) => swatches.map((color) => {
    const image = document.createElement("canvas");
    image.width = image.height = 32;
    const ctx = image.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
    return image.toDataURL().split(",")[1];
  }), colors);
  const files = fixtures.map((data, index) => ({
    name: `photo-${index}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  }));

  async function choosePhotos(selection) {
    const [chooser] = await Promise.all([
      fallback.waitForEvent("filechooser"),
      photoButton.click(),
    ]);
    assert.ok(chooser.isMultiple());
    await chooser.setFiles(selection);
  }

  await choosePhotos(files.slice(0, 3));
  await fallback.getByText("摆放模式 · 已贴 3 张照片", { exact: true }).waitFor();
  await choosePhotos(files.slice(3));
  await fallback.getByText("摆放模式 · 已贴 5 张照片", { exact: true }).waitFor();
  const selectedPhotoActions = fallback.getByRole("group", { name: "选中照片操作", exact: true });
  await selectedPhotoActions.waitFor();
  const topAdjust = fallback.locator(".editor-toolbox").getByRole("button", { name: "调整照片", exact: true });
  assert.equal(await topAdjust.getAttribute("aria-pressed"), "true");

  const canvasColors = () => canvas.evaluate((surface, expected) => {
    const pixels = surface.getContext("2d").getImageData(0, 0, surface.width, surface.height).data;
    const visible = new Set();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 250) continue;
      visible.add("#" + Array.from(pixels.slice(index, index + 3))
        .map((value) => value.toString(16).padStart(2, "0")).join(""));
    }
    return expected.filter((color) => visible.has(color));
  }, colors);
  assert.deepEqual(await canvasColors(), colors);

  await choosePhotos([]);
  assert.equal(await notice.textContent(), "摆放模式 · 已贴 5 张照片");
  assert.deepEqual(await canvasColors(), colors);

  await choosePhotos([files[0], {
    name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image"),
  }]);
  await fallback.getByText("这批照片无法打开，原有照片已保留。", { exact: true }).waitFor();
  assert.deepEqual(await canvasColors(), colors);

  await fallback.evaluate(() => {
    // Replace the accessor used by the app, rather than modifying one
    // StorageManager wrapper that WebKit may recreate between evaluations.
    const storage = { estimate: async () => ({ quota: 1, usage: 1 }) };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: storage,
    });
  });
  assert.deepEqual(await fallback.evaluate(() => navigator.storage.estimate()), { quota: 1, usage: 1 });
  await choosePhotos([files[0]]);
  await fallback.getByText("空间不足，原有照片已保留。", { exact: true }).waitFor();
  assert.deepEqual(await canvasColors(), colors);

  await undo.click();
  assert.equal(await notice.textContent(), "摆放模式 · 已贴 3 张照片");

  async function onPaper(points) {
    const before = await canvas.boundingBox();
    await draw(points);
    const after = await canvas.boundingBox();
    assert.ok(before && after);
    assert.ok(Math.abs(after.y - before.y) < 1,
      "Selecting a photo must not move the paper during a drag.");
  }

  const paperPixel = (x, y) => canvas.evaluate((surface, [left, top]) =>
    Array.from(surface.getContext("2d").getImageData(left, top, 1, 1).data), [x, y]);
  const rgb = async (x, y) => (await paperPixel(x, y)).slice(0, 3);
  const red = [179, 32, 66];
  const green = [39, 115, 72];
  const blue = [52, 75, 155];

  // Arrange the three visible photos into known positions before checking
  // independent transformations, erasure and undo against paper coordinates.
  for (const x of [100, 280, 460]) await onPaper([[x, 400], [x, 130]]);
  await onPaper([[100, 100], [100, 215], [100, 325]]);
  assert.equal((await paperPixel(100, 100))[3], 0);
  assert.deepEqual(await rgb(100, 325), red);
  assert.deepEqual(await rgb(280, 100), green);
  assert.deepEqual(await rgb(460, 100), blue);

  await onPaper([[280, 100]]);
  await selectedPhotoActions.waitFor();
  await onPaper([[590, 780]]);
  assert.equal(await selectedPhotoActions.count(), 0);
  await onPaper([[280, 100]]);
  await selectedPhotoActions.waitFor();

  const enlarge = fallback.getByRole("button", { name: "放大照片", exact: true });
  const shrink = fallback.getByRole("button", { name: "缩小照片", exact: true });
  const beforePhotoToolSwipe = await toolAndPaperState();
  const shrinkBounds = await shrink.boundingBox();
  const selectedPaperBounds = await canvas.boundingBox();
  assert.ok(shrinkBounds && selectedPaperBounds);
  await fallback.mouse.move(shrinkBounds.x + shrinkBounds.width / 2, shrinkBounds.y + shrinkBounds.height / 2);
  await fallback.mouse.down();
  await fallback.mouse.move(selectedPaperBounds.x + selectedPaperBounds.width / 2,
    selectedPaperBounds.y + 80, { steps: 5 });
  await fallback.mouse.up();
  assert.deepEqual(await toolAndPaperState(), beforePhotoToolSwipe);
  await enlarge.click();
  assert.deepEqual(await rgb(380, 100), green);
  await shrink.click();
  assert.equal((await paperPixel(380, 100))[3], 0);
  await enlarge.click();
  await onPaper([[460, 100]]);
  await fallback.getByRole("button", { name: "移除照片", exact: true }).click();
  assert.equal((await paperPixel(460, 100))[3], 0);
  assert.deepEqual(await rgb(380, 100), green);
  assert.deepEqual(await rgb(100, 325), red);

  await brushButton.click();
  assert.ok(!(await canvas.getAttribute("class")).includes("ink-canvas--placing"));
  assert.equal(await selectedPhotoActions.count(), 0);
  assert.equal(await topAdjust.getAttribute("aria-pressed"), "false");


  await onPaper([[100, 330], [118, 337], [125, 355], [118, 373],
    [100, 380], [82, 373], [75, 355], [82, 337], [100, 330]]);
  const circleAtOriginalPosition = () => canvas.evaluate((surface) => {
    const pixels = surface.getContext("2d").getImageData(96, 326, 9, 9).data;
    return pixels.some((red, index) => index % 4 === 0 && red < 65 &&
      pixels[index + 1] < 65 && pixels[index + 2] < 65 && pixels[index + 3] > 240);
  });
  assert.ok(await circleAtOriginalPosition());
  const adjust = fallback.getByRole("button", { name: "调整照片", exact: true });
  await adjust.click();
  await onPaper([[100, 355], [100, 555]]);
  assert.ok(await circleAtOriginalPosition());
  assert.deepEqual(await rgb(100, 555), red);

  await onPaper([[280, 100], [280, 395]]);
  assert.deepEqual(await rgb(280, 395), green);
  await brushButton.click();
  await onPaper([[340, 650], [410, 650]]);
  assert.ok(await hasInk(370, 650));
  await undo.click();
  assert.ok(!(await hasInk(370, 650)));
  assert.deepEqual(await rgb(280, 395), green);
  await undo.click();
  assert.equal((await paperPixel(280, 395))[3], 0);
  assert.deepEqual(await rgb(280, 100), green);
  assert.ok(await circleAtOriginalPosition());
  const editorDate = fallback.locator("main > section time");
  const photoPageDate = await editorDate.getAttribute("datetime");
  await back.click();
  const saveFailure = fallback.locator(".save-status");
  await monthHeading.or(saveFailure.filter({ visible: true })).first().waitFor();
  if (!(await monthHeading.isVisible())) {
    assert.fail(await saveFailure.textContent({ timeout: 1000 }));
  }
  await calendarOrButton(fallback, photoPageDate).click();
  await fallback.getByRole("button", { name: "编辑此页", exact: true }).click();
  const matchesPhoto = (pixel, expected) =>
    pixel[3] === 255 && expected.every((value, index) => Math.abs(pixel[index] - value) <= 2);
  async function checkRestoredCollage() {
    let restoredGreen;
    for (let attempt = 0; attempt < 50; attempt++) {
      restoredGreen = await paperPixel(280, 100);
      if (restoredGreen[3] === 255) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const restoredRed = await paperPixel(100, 555);
    if (!matchesPhoto(restoredGreen, green) || !matchesPhoto(restoredRed, red)) {
      const photoNotice = await notice.textContent();
      assert.fail(`Reopened photo pixels: green [${restoredGreen}], red [${restoredRed}]. Photo status: ${photoNotice || "(empty)"}`);
    }
    assert.equal((await paperPixel(460, 100))[3], 0);
    assert.ok(await circleAtOriginalPosition());
  }
  await checkRestoredCollage();

  const readPages = (target = fallback) => target.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("ei-ni-kan");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction("pages").objectStore("pages").getAll();
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
  const beforeMove = await readPages();
  const collage = beforeMove.find((row) => row.recordDate === photoPageDate && row.photos.length === 2);
  assert.ok(collage && collage.strokes.length > 0);
  const destination = "2026-10-15";
  const photoClick = (name) => calendarOrButton(fallback, name).click();
  const dateField = fallback.getByLabel("记录日期", { exact: true });
  await photoClick("修改记录日期");
  assert.equal(await dateField.inputValue(), photoPageDate);
  assert.equal(await dateField.getAttribute("max"), "2026-11-18");
  await dateField.fill("2026-11-19");
  await photoClick("应用日期");
  assert.equal(await editorDate.getAttribute("datetime"), photoPageDate);
  await dateField.fill(destination);
  await photoClick("取消改日期");
  assert.equal(await editorDate.getAttribute("datetime"), photoPageDate);
  await photoClick("修改记录日期");
  await dateField.fill(destination);
  await photoClick("应用日期");
  assert.equal(await editorDate.getAttribute("datetime"), destination);
  await back.click();
  await fallback.getByRole("heading", { name: "阅读", exact: true }).waitFor();
  assert.equal(await editorDate.getAttribute("datetime"), destination);
  const afterMove = await readPages();
  const countOn = (rows, date) => rows.filter((row) => row.recordDate === date).length;
  assert.equal(afterMove.length, beforeMove.length);
  assert.equal(countOn(afterMove, photoPageDate), countOn(beforeMove, photoPageDate) - 1);
  assert.equal(countOn(afterMove, destination), countOn(beforeMove, destination) + 1);
  assert.deepEqual(afterMove.find((row) => row.id === collage.id), { ...collage, recordDate: destination });

  await photoClick("返回月历");
  await fallback.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
  await photoClick("上个月");
  await photoClick(destination);
  await photoClick("编辑此页");
  await checkRestoredCollage();

  const confirmation = fallback.getByRole("dialog", { name: "删除这一页？" });
  await photoClick("编辑菜单");
  await photoClick("删除整页");
  await confirmation.waitFor();
  await photoClick("取消删除");
  await confirmation.waitFor({ state: "hidden" });
  await checkRestoredCollage();
  assert.deepEqual(await readPages(), afterMove);

  await photoClick("编辑菜单");
  await photoClick("删除整页");
  await confirmation.waitFor();
  await photoClick("确认删除");
  await fallback.getByRole("heading", { name: "2026年10月", exact: true }).waitFor();
  const remaining = afterMove.filter((row) => row.id !== collage.id);
  assert.deepEqual(await readPages(), remaining);

  await fallback.reload();
  await photoClick("打开日记本");
  await photoClick("上个月");
  await photoClick(destination);
  await fallback.getByRole("heading", { name: "编辑", exact: true }).waitFor();
  assert.equal(await fallback.getByRole("button", { name: "查看已有记录", exact: true }).count(), 0);
  assert.equal((await paperPixel(280, 100))[3], 0);
  await back.click();
  await fallback.getByRole("heading", { name: "2026年10月", exact: true }).waitFor();
  assert.deepEqual(await readPages(), remaining);

  async function calendarPreview(date, count, expected) {
    const button = fallback.getByRole("button", {
      name: `打开 ${date} 最新一页，共 ${count} 页`, exact: true,
    });
    const cell = button.locator("..");
    const layout = await cell.evaluate((cell) => {
      const preview = cell.querySelector(".calendar-preview");
      const date = cell.querySelector("time");
      return {
        dateHidden: getComputedStyle(date).display === "none",
        fill: preview.getBoundingClientRect().width / cell.getBoundingClientRect().width,
      };
    });
    assert.ok(layout.dateHidden);
    assert.ok(layout.fill > 0.75);
    await checkPreviewBoundaries(fallback);
    if (date === "2026-11-18") {
      assert.ok((await button.getAttribute("class")).includes("calendar-preview--today"));
    }

    const image = button.locator("img");
    await image.waitFor();
    const content = await image.evaluate(async (preview) => {
      await preview.decode();
      const sample = document.createElement("canvas");
      sample.width = preview.naturalWidth;
      sample.height = preview.naturalHeight;
      const context = sample.getContext("2d");
      context.drawImage(preview, 0, 0);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      const found = { ink: false, red: false, green: false };
      for (let index = 0; index < pixels.length; index += 4) {
        const [r, g, b] = pixels.subarray(index, index + 3);
        found.ink ||= r < 205 && g < 205 && b < 205 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
        found.red ||= r > 140 && g < 80 && b < 100;
        found.green ||= r < 75 && g > 95 && b < 100;
      }
      return found;
    });
    for (const kind of expected) assert.ok(content[kind], `Missing ${kind} in preview for ${date}`);
    return button;
  }

  await photoClick("下个月");
  const inkPages = remaining.filter((row) => row.recordDate === photoPageDate);
  assert.ok(inkPages.length > 0 && inkPages.every((row) => row.photos.length === 0));
  // Earlier ink-only pages used different brush colors. A decoded preview
  // suffices here, and the new ink-only top page below checks visible ink.
  await calendarPreview(photoPageDate, inkPages.length, []);
  const previewViewport = fallback.viewportSize();
  for (const size of [{ width: 320, height: 700 }, { width: 844, height: 390 }]) {
    await fallback.setViewportSize(size);
    await checkPreviewBoundaries(fallback);
  }
  await fallback.setViewportSize(previewViewport);

  await photoClick("上个月");
  const photoDate = "2026-10-14";
  await photoClick(photoDate);
  await choosePhotos([files[0], files[2]]);
  await fallback.getByText("摆放模式 · 已贴 2 张照片", { exact: true }).waitFor();
  await back.click();
  const photoOnly = await calendarPreview(photoDate, 1, ["red"]);
  assert.ok(!(await photoOnly.getAttribute("class")).includes("calendar-preview--stacked"));

  const mixedDate = "2026-10-16";
  await photoClick(mixedDate);
  await canvas.evaluate((surface) => {
    const bounds = surface.getBoundingClientRect();
    const capture = surface.setPointerCapture;
    surface.setPointerCapture = () => {};
    function send(type, id, x) {
      surface.dispatchEvent(new PointerEvent(type, {
        pointerType: "touch", pointerId: id, button: 0,
        clientX: bounds.x + x * bounds.width / 600,
        clientY: bounds.y + 300 * bounds.height / 800,
      }));
    }
    try {
      send("pointerdown", 1, 200);
      send("pointerdown", 2, 400);
      send("pointermove", 1, 100);
      send("pointermove", 2, 500);
      send("pointerup", 1, 100);
      send("pointerup", 2, 500);
    } finally { surface.setPointerCapture = capture; }
  });
  await choosePhotos([files[1]]);
  await fallback.getByText("摆放模式 · 已贴 1 张照片", { exact: true }).waitFor();
  assert.equal(await canvas.evaluate((surface) => surface.getContext("2d").getTransform().a), 2);
  assert.deepEqual(await rgb(300, 400), green);
  await selectedPhotoActions.waitFor();
  assert.ok(await fallback.getByRole("button", { name: "缩小照片", exact: true }).isEnabled());
  await photoClick("整页");
  await brushButton.click();
  await onPaper([[340, 650], [410, 650]]);
  await back.click();
  await calendarPreview(mixedDate, 1, ["green", "ink"]);

  await fallback.clock.setFixedTime(new Date("2026-11-18T04:02:00Z"));
  await photoClick(mixedDate);
  await photoClick("为这一天添一页");
  await onPaper([[200, 600], [300, 600]]);
  await back.click();
  const stacked = await calendarPreview(mixedDate, 2, ["ink"]);
  assert.ok((await stacked.getAttribute("class")).includes("calendar-preview--stacked"));
  await stacked.click();
  await photoClick("编辑此页");
  assert.ok(await hasInk(250, 600));
  assert.ok(!(await hasInk(370, 650)));
  await back.click();
  await photoClick("返回月历");

  await fallback.clock.setFixedTime(new Date("2026-11-18T04:03:00Z"));
  await photoClick(mixedDate);
  await photoClick("为这一天添一页");
  await choosePhotos([files[0]]);
  await fallback.getByText("摆放模式 · 已贴 1 张照片", { exact: true }).waitFor();
  await back.click();
  const threePages = await calendarPreview(mixedDate, 3, ["red"]);
  for (const size of [{ width: 320, height: 700 }, { width: 844, height: 390 }]) {
    await fallback.setViewportSize(size);
    await checkPreviewBoundaries(fallback);
  }
  await fallback.setViewportSize(previewViewport);
  await threePages.click();

  const tabs = fallback.getByRole("group", { name: "当天页签" });
  const tab = (number) => tabs.getByRole("button", { name: `第 ${number} 页`, exact: true });
  const readingPaper = fallback.getByRole("img", { name: "阅读画纸", exact: true });
  const readingPixel = (x, y) => readingPaper.evaluate((surface, [left, top]) =>
    Array.from(surface.getContext("2d").getImageData(left, top, 1, 1).data), [x, y]);
  const readingHasInk = (x, y) => readingPaper.evaluate((surface, [left, top]) => {
    const pixels = surface.getContext("2d").getImageData(left - 4, top - 4, 9, 9).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  }, [x, y]);
  function waitForPhoto(color) {
    return fallback.waitForFunction((rgb) => {
      const paper = document.querySelector(".reading-canvas");
      const pixel = paper?.getContext("2d").getImageData(300, 400, 1, 1).data;
      return pixel?.[3] === 255 && rgb.every((value, index) => Math.abs(pixel[index] - value) <= 2);
    }, color, { polling: 100 });
  }

  await tabs.waitFor();
  assert.deepEqual(await tabs.getByRole("button").allTextContents(), ["1", "2", "3"]);
  assert.equal(await tab(3).getAttribute("aria-pressed"), "true");
  await waitForPhoto(red);
  assert.ok(!(await readingHasInk(250, 600)));
  await tab(2).click();
  assert.equal(await tab(2).getAttribute("aria-pressed"), "true");
  assert.ok(await readingHasInk(250, 600));
  assert.equal((await readingPixel(100, 100))[3], 0);
  await tab(1).click();
  await waitForPhoto(green);
  assert.ok(await readingHasInk(370, 650));
  assert.ok(!(await readingHasInk(250, 600)));
  assert.equal(await readingPaper.count(), 1);

  await photoClick("编辑此页");
  await onPaper([[200, 700], [300, 700]]);
  await back.click();
  await tabs.waitFor();
  assert.deepEqual(await tabs.getByRole("button").allTextContents(), ["1", "2", "3"]);
  assert.equal(await tab(1).getAttribute("aria-pressed"), "true");
  await waitForPhoto(green);
  assert.ok(await readingHasInk(250, 700));
  await tab(3).click();
  await waitForPhoto(red);
  assert.ok(!(await readingHasInk(250, 700)));
  await photoClick("返回月历");
  await fallback.getByRole("heading", { name: "2026年10月", exact: true }).waitFor();

  await fallback.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const pagesBeforeExport = await readPages();
  await photoClick("日记本菜单");
  await photoClick("导出备份");
  await fallback.getByText(`备份已准备好，共 ${pagesBeforeExport.length} 页。`, { exact: true }).waitFor();
  const [download] = await Promise.all([fallback.waitForEvent("download"), photoClick("下载 ZIP")]);
  assert.match(download.suggestedFilename(), /\.zip$/);
  const backupBytes = await readFile(await download.path());
  const zip = unzipSync(backupBytes);
  const backup = JSON.parse(new TextDecoder().decode(zip["manifest.json"]));
  assert.equal(backup.format, "ei-ni-kan-backup");
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.pages.map(({ page }) => page), pagesBeforeExport);
  assert.ok(backup.pages.some(({ page, photos }) => page.strokes.length > 0 && photos.length === 0));
  const photoBackup = backup.pages.find(({ page }) => page.recordDate === photoDate);
  assert.ok(photoBackup);
  assert.equal(photoBackup.photos.length, 2);
  for (const [index, asset] of photoBackup.photos.entries()) {
    assert.equal(asset.original.type, "image/png");
    assert.equal(zip[asset.original.path].byteLength, asset.original.size);
    assert.deepEqual(Buffer.from(zip[asset.original.path]), files[index === 0 ? 0 : 2].buffer);
    assert.ok(zip[asset.preview.path].byteLength > 0);
  }
  assert.deepEqual(await readPages(), pagesBeforeExport);

  const restoreContext = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => restoreContext.close());
  const restored = restoreContext.pages()[0] ?? await restoreContext.newPage();
  await restored.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await restored.goto("http://127.0.0.1:" + port);
  const restoreClick = (name) => restored.getByRole("button", { name, exact: true }).click();
  await restoreClick("打开日记本");
  await restoreClick("上个月");
  await restoreClick("日记本菜单");
  const restoreDialog = restored.getByRole("dialog", { name: "恢复备份？", exact: true });
  async function selectBackup(buffer) {
    const [picker] = await Promise.all([
      restored.waitForEvent("filechooser"), restoreClick("从备份恢复"),
    ]);
    await picker.setFiles({ name: "diary-backup.zip", mimeType: "application/zip", buffer });
  }
  async function previewBackup() {
    await selectBackup(backupBytes);
    await restoreDialog.getByText(`备份包含 ${pagesBeforeExport.length} 页。已有的页面会保留本机版本。`).waitFor();
  }
  await previewBackup();
  await restoreClick("取消恢复");
  await restoreDialog.waitFor({ state: "hidden" });
  assert.deepEqual(await readPages(restored), []);
  await previewBackup();
  await restoreClick("确认恢复");
  await restored.getByText(`已恢复 ${pagesBeforeExport.length} 页，保留本机已有的 0 页。`, { exact: true }).waitFor();
  assert.deepEqual(await readPages(restored), pagesBeforeExport);

  await restoreClick("日记本菜单");
  await restored.locator(".calendar-preview img").first().waitFor();
  await checkPreviewBoundaries(restored);
  await restoreClick(`打开 ${photoDate} 最新一页，共 1 页`);
  await restored.waitForFunction(() => {
    const paper = document.querySelector(".reading-canvas");
    const context = paper?.getContext("2d");
    const red = context?.getImageData(100, 400, 1, 1).data;
    const blue = context?.getImageData(400, 400, 1, 1).data;
    return red?.[0] > 140 && red[3] === 255 && blue?.[2] > 120 && blue[3] === 255;
  }, undefined, { polling: 100 });
  await restoreClick("编辑此页");
  await restored.locator(".ink-canvas").click({ position: { x: 50, y: 140 } });
  await restoreClick("保存");
  await restored.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "已保存");
  assert.ok(await restored.locator(".ink-canvas").isVisible());
  await restoreClick("返回");
  await restoreClick("返回月历");
  const localPages = await readPages(restored);
  assert.equal(localPages.find(({ id }) => id === photoBackup.page.id).strokes.length, 1);
  await restoreClick("日记本菜单");
  await previewBackup();
  await restoreClick("确认恢复");
  await restored.getByText(`已恢复 0 页，保留本机已有的 ${pagesBeforeExport.length} 页。`, { exact: true }).waitFor();
  assert.deepEqual(await readPages(restored), localPages);
  await selectBackup(backupBytes.subarray(0, -22));
  await restored.getByText("无法读取备份。请选择完整的「ei ？」ZIP 备份。", { exact: true }).waitFor();
  assert.deepEqual(await readPages(restored), localPages);

  assert.deepEqual(errors, []);
});

test("editor autosaves before returning and retries a failed write without duplicating a page", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const browser = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => browser.close());
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);

  const click = (name) => calendarOrButton(page, name).click();
  const see = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
  const canvas = page.locator(".ink-canvas");
  const draw = () => canvas.click({ position: { x: 40, y: 55 } });
  const hasInk = () => canvas.evaluate((surface) => {
    const ctx = surface.getContext("2d");
    const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  async function reopen(date) {
    await click(date);
    await click("编辑此页");
    assert.ok(await hasInk());
  }

  await click("打开日记本");
  await click("添一页");
  await draw();
  await click("返回");
  await see("2026年11月");
  await page.reload();
  await click("打开日记本");
  await reopen("2026-11-18");
  await click("返回");
  await see("阅读");
  await click("返回月历");

  await click("2026-11-17");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "pages") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Simulated storage failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await draw();
  await click("返回");
  await page.getByText("没能保存，这一页还在。请重试。", { exact: true }).waitFor();
  await see("编辑");
  assert.ok(await hasInk());
  await click("重试保存");
  await click("返回");
  await see("2026年11月");
  await reopen("2026-11-17");

  const savedDates = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("ei-ni-kan");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction("pages").objectStore("pages").getAll();
      read.onsuccess = () => { db.close(); resolve(read.result.map((row) => row.recordDate)); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
  assert.deepEqual(savedDates.sort(), ["2026-11-17", "2026-11-18"]);
});

test("the app starts offline and waits until editing ends to offer a worker update", { timeout: 60_000 }, async (t) => {
  const worker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
  let revision = 1;
  let networkAvailable = true;
  const server = await preview({
    preview: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "serve-two-worker-revisions",
      configurePreviewServer({ middlewares }) {
        middlewares.use((request, _response, next) => {
          // Drop network requests at the origin while allowing WebKit to
          // dispatch navigation to its registered service worker.
          if (!networkAvailable) request.socket.destroy();
          else next();
        });
        middlewares.use("/sw.js", (_request, response) => {
          response.writeHead(200, {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store",
          });
          response.end(`${worker}\n// Test deployment ${revision}\n`);
        });
      },
    }],
  });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const context = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  context.on("close", () => t.diagnostic("Offline test: persistent context closed"));
  context.on("page", (opened) => {
    opened.on("crash", () => t.diagnostic("Offline test: page crashed"));
  });
  t.after(() => context.close());
  const origin = "http://127.0.0.1:" + server.httpServer.address().port;
  let page = context.pages()[0] ?? await context.newPage();
  async function launch() {
    await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
    await page.goto(origin);
    await page.getByRole("button", { name: "打开日记本", exact: true }).waitFor();
  }
  const click = (name) => calendarOrButton(page, name).click();
  await launch();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByText("离线已就绪", { exact: true }).waitFor();
  // Keep one page alive: closing the last persistent WebKit page can close its context.
  const onlinePage = page;
  page = await context.newPage();
  await onlinePage.close();
  networkAvailable = false;
  await launch();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const offlineFontReady = await page.evaluate(async () => {
    const fonts = await document.fonts.load('16px "Diary Hand"', "2026年11月恢复备份颜色粗细");
    return fonts.some((font) => font.status === "loaded");
  });
  assert.ok(offlineFontReady, "The self-hosted handwriting font should load on an offline restart.");
  await click("打开日记本");
  await click("添一页");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), click("照片")]);
  await chooser.setFiles({
    name: "offline-photo.png",
    mimeType: "image/png",
    buffer: await readFile(new URL("../public/icons/icon-192.png", import.meta.url)),
  });
  await page.getByText("摆放模式 · 已贴 1 张照片", { exact: true }).waitFor();
  await click("返回");
  await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
  const savedPage = page;
  page = await context.newPage();
  await savedPage.close();
  await launch();
  await click("打开日记本");
  await click("打开 2026-11-18 最新一页，共 1 页");
  const waitForPhoto = () => page.waitForFunction(() => {
    const paper = document.querySelector(".reading-canvas");
    return paper?.getContext("2d").getImageData(300, 400, 1, 1).data[3] === 255;
  }, undefined, { polling: 100 });
  await waitForPhoto();
  await click("编辑此页");
  const canvas = page.locator(".ink-canvas");
  const size = await canvas.boundingBox();
  assert.ok(size);
  await canvas.click({ position: { x: size.width * 0.5, y: size.height * 0.75 } });

  revision = 2;
  networkAvailable = true;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
  assert.ok(await page.getByRole("heading", { name: "编辑", exact: true }).isVisible());
  assert.equal(await page.getByRole("button", { name: "更新应用", exact: true }).count(), 0);
  await click("返回");
  await page.getByRole("button", { name: "更新应用", exact: true }).waitFor();
  await Promise.all([page.waitForEvent("load"), click("更新应用")]);
  await click("打开日记本");
  await click("打开 2026-11-18 最新一页，共 1 页");
  await waitForPhoto();
  const inkSurvived = await page.locator(".reading-canvas").evaluate((surface) => {
    const pixels = surface.getContext("2d").getImageData(294, 594, 13, 13).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  assert.ok(inkSurvived);
});

test("reading follows the diary order across dates and disables the ends", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const context = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => context.close());
  const page = context.pages()[0] ?? await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
  const button = (name) => calendarOrButton(page, name);
  await button("打开日记本").click();
  await button("2026-11-17").click();
  await button("返回").click();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("ei-ni-kan");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("pages", "readwrite");
      const pages = tx.objectStore("pages");
      for (const date of ["2026-11-16", "2026-11-18"]) {
        for (const index of [3, 1, 2]) {
          pages.add({
            id: `${date}-${index}`, recordDate: date, createdAt: index,
            strokes: [{ points: [{ x: 100 * index, y: 100 }], width: 8, color: "#252322" }],
            photos: [],
          });
        }
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await button("2026-11-18").click();

  const older = button("向旧翻");
  const newer = button("向新翻");
  const tabs = page.getByRole("group", { name: "当天页签" });
  async function seePage(date, number) {
    await tabs.getByRole("button", { name: `第 ${number} 页`, exact: true, pressed: true }).waitFor();
    assert.equal(await page.locator("main > section time").getAttribute("datetime"), date);
    const ink = await page.getByRole("img", { name: "阅读画纸" }).evaluate((canvas, x) =>
      canvas.getContext("2d").getImageData(x, 100, 1, 1).data[3], number * 100);
    assert.equal(ink, 255);
    const centered = await page.locator(".paper-viewport").evaluate((viewport) => {
      const bounds = viewport.getBoundingClientRect();
      const paper = viewport.querySelector(".page-turn").getBoundingClientRect();
      return paper.left >= bounds.left && paper.right <= bounds.right + 1
        && paper.top >= bounds.top && paper.bottom <= bounds.bottom + 1
        && Math.abs((paper.left + paper.right - bounds.left - bounds.right) / 2) < 2
        && Math.abs((paper.top + paper.bottom - bounds.top - bounds.bottom) / 2) < 2;
    });
    assert.ok(centered, "Reading should open the whole page centered.");
  }

  await seePage("2026-11-18", 3);
  const readingZoom = await page.locator(".reading-canvas").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const capture = canvas.setPointerCapture;
    canvas.setPointerCapture = () => {};
    const send = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerType: "touch", pointerId: id, button: 0, isPrimary: id === 1,
      clientX: rect.left + x * rect.width / 600,
      clientY: rect.top + y * rect.height / 800,
    }));
    const ink = (x, y) => canvas.getContext("2d").getImageData(x, y, 1, 1).data[3];
    try {
      send("pointerdown", 1, 200, 300);
      send("pointerdown", 2, 400, 300);
      send("pointermove", 1, 100, 300);
      send("pointermove", 2, 500, 300);
      const zoomed = ink(300, 100) === 0;
      send("pointermove", 1, 200, 300);
      send("pointermove", 2, 400, 300);
      const restored = ink(300, 100) === 255;
      send("pointerup", 1, 200, 300);
      send("pointermove", 2, 500, 400);
      const stable = ink(300, 100) === 255;
      send("pointerup", 2, 500, 400);
      const viewport = canvas.closest(".paper-viewport");
      return { zoomed, restored, stable,
        noOuterScroll: viewport.scrollLeft === 0 && viewport.scrollTop === 0 };
    } finally {
      canvas.setPointerCapture = capture;
    }
  });
  assert.deepEqual(readingZoom, { zoomed: true, restored: true, stable: true, noOuterScroll: true });
  async function zoomReading() {
    await page.locator(".reading-canvas").evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const capture = canvas.setPointerCapture;
      canvas.setPointerCapture = () => {};
      function send(type, id, x) {
        canvas.dispatchEvent(new PointerEvent(type, {
          pointerType: "touch", pointerId: id, button: 0,
          clientX: rect.left + x * rect.width / 600,
          clientY: rect.top + 300 * rect.height / 800,
        }));
      }
      try {
        send("pointerdown", 1, 200);
        send("pointerdown", 2, 400);
        send("pointermove", 1, 100);
        send("pointermove", 2, 500);
        send("pointerup", 1, 100);
        send("pointerup", 2, 500);
      } finally {
        canvas.setPointerCapture = capture;
      }
    });
  }
  await zoomReading();
  assert.ok(await older.isDisabled());
  assert.ok(await newer.isDisabled());
  await button("整页").click();
  await seePage("2026-11-18", 3);
  assert.ok(await older.isEnabled());
  await zoomReading();
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() =>
    document.querySelector(".reading-canvas").getContext("2d").getTransform().a === 1,
    undefined, { polling: 100 });
  await seePage("2026-11-18", 3);
  await page.setViewportSize(originalViewport);
  await page.waitForFunction(() =>
    document.querySelector(".paper-viewport").clientHeight > 400,
    undefined, { polling: 100 });
  await seePage("2026-11-18", 3);
  assert.ok(await newer.isDisabled());
  await older.click();
  await seePage("2026-11-18", 2);
  await older.click();
  await seePage("2026-11-18", 1);
  await older.click();
  await seePage("2026-11-16", 3);
  await newer.click();
  await seePage("2026-11-18", 1);
  await older.click();
  await older.click();
  await older.click();
  await seePage("2026-11-16", 1);
  assert.ok(await older.isDisabled());

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const paperStage = page.locator(".page-turn");
  const folded = paperStage.and(page.locator("[data-turn-direction]"));
  await paperStage.scrollIntoViewIfNeeded();
  const paperBox = await page.locator(".paper-viewport").boundingBox();
  assert.ok(paperBox);
  const center = { x: paperBox.x + paperBox.width / 2, y: paperBox.y + paperBox.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - paperBox.width * 0.36, center.y);
  await page.mouse.up();
  assert.equal(await folded.count(), 0);
  await seePage("2026-11-16", 1);

  await newer.scrollIntoViewIfNeeded();
  const cornerBox = await newer.boundingBox();
  assert.ok(cornerBox);
  const corner = { x: cornerBox.x + cornerBox.width / 2, y: cornerBox.y + cornerBox.height / 2 };
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 12, corner.y - 8);
  await folded.waitFor();
  assert.equal(await folded.getAttribute("data-turn-direction"), "newer");
  const revealedInk = await folded.locator(".page-turn-under").evaluate((canvas) =>
    canvas.getContext("2d").getImageData(200, 100, 1, 1).data[3]);
  assert.equal(revealedInk, 255);
  await page.mouse.up();
  await folded.waitFor({ state: "hidden" });
  await seePage("2026-11-16", 1);

  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - paperBox.width * 0.4, corner.y - paperBox.height * 0.15, { steps: 5 });
  await folded.waitFor();
  await page.mouse.up();
  await seePage("2026-11-16", 2);
  await folded.waitFor({ state: "hidden" });

  await newer.click();
  await seePage("2026-11-16", 3);
  await newer.click();
  await seePage("2026-11-18", 1);
  await folded.waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const immediate = await older.evaluate((button) => {
    button.click();
    return { date: document.querySelector("main > section time").dateTime,
      folding: !!document.querySelector("[data-turn-direction]") };
  });
  assert.deepEqual(immediate, { date: "2026-11-16", folding: false });
  await seePage("2026-11-16", 3);

  await button("编辑此页").click();
  const editorPaper = page.locator(".ink-canvas");
  const editorBox = await editorPaper.boundingBox();
  assert.ok(editorBox);
  await editorPaper.evaluate((canvas) => {
    canvas.scrollIntoView({ block: "end", inline: "end", behavior: "instant" });
  });
  const cornerBoxInEditor = await editorPaper.boundingBox();
  assert.ok(cornerBoxInEditor);
  const cornerPoint = {
    x: cornerBoxInEditor.x + cornerBoxInEditor.width - 12,
    y: cornerBoxInEditor.y + cornerBoxInEditor.height - 12,
  };
  const hit = await page.evaluate(({ x, y }) => ({
    target: document.elementFromPoint(x, y)?.className ?? null,
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }), cornerPoint);
  assert.equal(hit.target, "ink-canvas",
    `The lower corner should receive the drawing pointer: ${JSON.stringify({ cornerPoint, hit })}`);
  await page.mouse.click(cornerPoint.x, cornerPoint.y);
  assert.equal(await folded.count(), 0);
  const drewAtCorner = await editorPaper.evaluate((canvas) => {
    const pixels = canvas.getContext("2d").getImageData(550, 740, 50, 60).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  assert.ok(drewAtCorner);
  await button("返回").click();
  await seePage("2026-11-16", 3);
  await button("返回月历").click();
  await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
});


test("native touch selects visible tools and draws at the screen position after reopening", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const url = "http://127.0.0.1:" + server.httpServer.address().port;
  for (const width of [390, 320]) {
    // Saving even a pen-only page writes a thumbnail Blob. WebKit ephemeral
    // contexts reject IndexedDB Blob writes; use a fresh persistent profile.
    const context = await webkit.launchPersistentContext("", {
      ...devices["iPhone 13"], viewport: { width, height: 844 },
      timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
    });
    const page = context.pages()[0] ?? await context.newPage();
    try {
      await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
      await page.goto(url);
      const tap = (name) => page.getByRole("button", { name, exact: true }).tap();
      await tap("打开日记本");
      await tap("添一页");
      await page.evaluate(async () => {
        await document.fonts.ready;
        let last = "";
        let stable = 0;
        for (let frame = 0; frame < 120; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const rect = document.querySelector(".ink-canvas").getBoundingClientRect();
          const next = JSON.stringify([rect.x, rect.y, rect.width, rect.height]);
          stable = next === last ? stable + 1 : 0;
          last = next;
          if (stable >= 4) return;
        }
        throw new Error("Touch test paper layout did not settle.");
      });
      await tap("嫩绿");
      assert.equal(await page.getByRole("button", { name: "嫩绿", exact: true }).getAttribute("aria-pressed"), "true");
      const canvas = page.locator(".ink-canvas");
      const bounds = await canvas.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      assert.ok(await page.evaluate(({ x, y }) =>
        document.elementFromPoint(x, y)?.matches(".ink-canvas"), point));
      await canvas.evaluate((surface) => {
        surface.addEventListener("pointerdown", (event) => {
          surface.dataset.touchEvidence = JSON.stringify({ trusted: event.isTrusted, type: event.pointerType });
        }, { once: true });
      });
      await page.touchscreen.tap(point.x, point.y);
      assert.deepEqual(JSON.parse(await canvas.getAttribute("data-touch-evidence")), { trusted: true, type: "touch" });
      const greenAtPoint = async (selector, location) => {
        try {
          await page.waitForFunction(({ selector, location }) => {
            const surface = document.querySelector(selector);
            if (!surface) return false;
            const x = Math.floor(surface.width * location.x);
            const y = Math.floor(surface.height * location.y);
            const pixels = surface.getContext("2d").getImageData(x - 5, y - 5, 11, 11).data;
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i + 3] > 200 && Math.abs(pixels[i] - 183) <= 2
                && Math.abs(pixels[i + 1] - 207) <= 2 && Math.abs(pixels[i + 2] - 130) <= 2) return true;
            }
            return false;
          }, { selector, location }, { timeout: 5000 });
        } catch (error) {
          const evidence = await page.evaluate(() => ({
            touch: document.querySelector(".ink-canvas")?.dataset.touchEvidence,
            selected: Array.from(document.querySelectorAll(".editor-toolbox [aria-pressed=true]"),
              (element) => element.getAttribute("aria-label")),
            viewport: [visualViewport?.width, visualViewport?.height, visualViewport?.scale],
          }));
          throw new Error(`Touch ink missing at ${selector} ${JSON.stringify(location)}; ${JSON.stringify(evidence)}`, { cause: error });
        }
      };
      await greenAtPoint(".ink-canvas", { x: 0.5, y: 0.5 });
      await page.waitForFunction(() => !document.querySelector('button[aria-label="撤销"]').disabled);
      await tap("撤销");
      assert.ok(await canvas.evaluate((surface) =>
        !surface.getContext("2d").getImageData(0, 0, surface.width, surface.height).data
          .some((value, index) => index % 4 === 3 && value > 0)));
      // Use a fresh screen location after undo, rather than reusing the earlier bounds.
      // Native WebKit touches round coordinates; retain the actual down position for pixel checks.
      const nextBounds = await canvas.boundingBox();
      assert.ok(nextBounds);
      await canvas.evaluate((surface) => {
        surface.addEventListener("pointerdown", (event) => {
          const rect = surface.getBoundingClientRect();
          surface.dataset.touchEvidence = JSON.stringify({
            trusted: event.isTrusted, type: event.pointerType,
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
          });
        }, { once: true });
      });
      await page.touchscreen.tap(nextBounds.x + nextBounds.width * 0.65,
        nextBounds.y + nextBounds.height * 0.65);
      const touch = JSON.parse(await canvas.getAttribute("data-touch-evidence"));
      assert.equal(touch.trusted, true);
      assert.equal(touch.type, "touch");
      assert.ok(Math.abs(touch.x - 0.65) < 0.02 && Math.abs(touch.y - 0.65) < 0.02);
      const savedPoint = { x: touch.x, y: touch.y };
      await greenAtPoint(".ink-canvas", savedPoint);
      // A visible dot can still be a pointerdown preview. Wait for pointerup to commit it.
      // Undo was disabled above, so becoming enabled proves the second stroke was committed.
      await page.waitForFunction(() => !document.querySelector('button[aria-label="撤销"]').disabled);
      await tap("保存");
      await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "已保存");
      assert.ok(await canvas.isVisible(), "Native save must keep the user on the paper.");
      await page.getByRole("button", { name: "返回", exact: true }).evaluate(async (back) => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        back.addEventListener("click", () => { document.body.dataset.nativeBackClicked = "true"; }, { once: true });
      });
      await tap("返回");
      try {
        await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor({ timeout: 5000 });
      } catch (error) {
        const state = await page.evaluate(() => ({
          clicked: document.body.dataset.nativeBackClicked ?? "false",
          inert: document.querySelector("main > section")?.inert,
          status: document.querySelector(".save-status")?.textContent,
          heading: document.querySelector("main h1")?.textContent,
        }));
        throw new Error(`Native back did not reach calendar: ${JSON.stringify(state)}`, { cause: error });
      }
      await page.reload();
      await tap("打开日记本");
      await tap("打开 2026-11-18 最新一页，共 1 页");
      await greenAtPoint(".reading-canvas", savedPoint);
      await tap("编辑此页");
      await greenAtPoint(".ink-canvas", savedPoint);
    } finally {
      await context.close();
    }
  }
});


test("manual save keeps editing, waits for newer changes and does not create blank pages", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const context = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => context.close());
  const page = context.pages()[0] ?? await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
  const click = (name) => calendarOrButton(page, name).click();
  const save = page.getByRole("button", { name: "保存", exact: true });
  await click("打开日记本");
  await click("添一页");
  await save.click();
  await page.getByText("画一笔或贴张照片再保存。", { exact: true }).waitFor();
  await click("返回");
  await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
  assert.equal(await page.locator(".calendar-preview").count(), 0);
  await click("添一页");
  const canvas = page.locator(".ink-canvas");
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const waiting = [];
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      waiting.push(() => original.apply(this, args));
    };
    window.releaseManualSave = () => {
      HTMLCanvasElement.prototype.toBlob = original;
      for (const release of waiting) release();
    };
  });
  await canvas.click({ position: { x: 45, y: 60 } });
  await save.click();
  assert.equal(await save.textContent(), "保存中…");
  assert.ok(await save.isDisabled());
  await save.evaluate((button) => { button.click(); button.click(); });
  await canvas.click({ position: { x: 90, y: 120 } });
  await click("修改记录日期");
  await page.getByLabel("记录日期", { exact: true }).fill("2026-11-17");
  await click("应用日期");
  assert.equal(await save.textContent(), "保存中…");
  await page.evaluate(() => window.releaseManualSave());
  await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "已保存");
  await page.getByRole("heading", { name: "编辑", exact: true }).waitFor({ state: "attached" });
  assert.ok(await canvas.isVisible());
  await click("返回");
  await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
  await page.reload();
  await click("打开日记本");
  await click("2026-11-17");
  await click("编辑此页");
  const fixture = await page.evaluate(() => {
    const source = document.createElement("canvas");
    source.width = source.height = 32;
    const context = source.getContext("2d");
    context.fillStyle = "#277348";
    context.fillRect(0, 0, 32, 32);
    return source.toDataURL().split(",")[1];
  });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), click("照片")]);
  await chooser.setFiles({ name: "manual-save.png", mimeType: "image/png", buffer: Buffer.from(fixture, "base64") });
  await page.getByText("摆放模式 · 已贴 1 张照片", { exact: true }).waitFor();
  await save.click();
  await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "已保存");
  const pages = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("ei-ni-kan");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("pages").objectStore("pages").getAll();
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].recordDate, "2026-11-17");
  assert.equal(pages[0].strokes.length, 2);
  assert.equal(pages[0].photos.length, 1);
});


test("failed manual and return saves retain the paper and share retry without moving its layout", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  }));
  const context = await webkit.launchPersistentContext("", {
    ...devices["iPhone 13"], timezoneId: "Asia/Shanghai", reducedMotion: "reduce",
  });
  t.after(() => context.close());
  const page = context.pages()[0] ?? await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
  const click = (name) => calendarOrButton(page, name).click();
  const save = page.getByRole("button", { name: "保存", exact: true });
  const canvas = page.locator(".ink-canvas");
  await click("打开日记本");
  await click("添一页");
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let frame = 0; frame < 6; frame++) await new Promise((resolve) => requestAnimationFrame(resolve));
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "pages") throw new DOMException("Simulated storage full", "QuotaExceededError");
      return original.apply(this, args);
    };
    window.restoreManualWrites = () => { IDBObjectStore.prototype.put = original; };
  });
  const geometry = () => page.evaluate(() => [".editor-topbar", ".editor-toolbox", ".ink-canvas"].map((selector) => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height];
  }));
  const before = await geometry();
  await canvas.click({ position: { x: 45, y: 60 } });
  await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "保存失败");
  assert.deepEqual(await geometry(), before);
  await save.click();
  await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "保存失败");
  assert.ok(await canvas.isVisible());
  await click("返回");
  await page.getByText("没能保存，这一页还在。请重试。", { exact: true }).waitFor();
  assert.deepEqual(await geometry(), before);
  await page.evaluate(() => window.restoreManualWrites());
  await save.click();
  await page.waitForFunction(() => document.querySelector(".editor-save-button")?.textContent === "已保存");
  assert.deepEqual(await geometry(), before);
  await click("返回");
  await page.getByRole("heading", { name: "2026年11月", exact: true }).waitFor();
  await click("2026-11-18");
  await click("编辑此页");
  await context.setOffline(true);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const pending = [];
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      pending.push(() => original.apply(this, args));
    };
    window.finishReturnWrite = () => {
      HTMLCanvasElement.prototype.toBlob = original;
      for (const release of pending) release();
    };
  });
  await canvas.click({ position: { x: 80, y: 100 } });
  await click("返回");
  await page.waitForFunction(() => document.querySelector("main > section")?.inert === true);
  assert.equal(await save.textContent(), "保存中…");
  await page.getByRole("button", { name: "返回", exact: true }).evaluate((button) => {
    button.click(); button.click();
  });
  await page.evaluate(() => window.finishReturnWrite());
  await page.getByRole("heading", { name: "阅读", exact: true }).waitFor({ state: "attached" });
  await click("编辑此页");
  const saved = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("ei-ni-kan");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("pages").objectStore("pages").getAll();
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].strokes.length, 2);
});

test("offline preparation reports registration failure and can retry", { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  t.after(() => new Promise((resolve) => server.httpServer.close(resolve)));
  const context = await webkit.launchPersistentContext("", { ...devices["iPhone 13"] });
  t.after(() => context.close());
  let blocked = true;
  await context.route("**/sw.js", (route) => blocked ? route.abort() : route.continue());
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
  await page.getByText("离线准备失败，请联网重试", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false);
  blocked = false;
  await page.getByRole("button", { name: "重试离线准备", exact: true }).click();
  await page.getByText("离线已就绪", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
});
