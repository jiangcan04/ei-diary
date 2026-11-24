import { isolateToolTouch } from "./tool-touch";
import { brushColors, brushWidths, defaultBrush, type BrushSettings } from "./brush-settings";

export function createEditorTools(
  onBrushChange: (brush: BrushSettings) => void,
  onEraserChange: (erasing: boolean) => void,
  onUndo: () => void,
  onChoosePhotos: () => void,
  onPenSelected: () => void,
  onAdjustPhotos: () => void,
) {
  const section = document.createElement("div");
  section.className = "editor-toolbox";
  isolateToolTouch(section);
  section.setAttribute("role", "group");
  section.setAttribute("aria-label", "编辑工具");
  const group = document.createElement("div");
  group.className = "editor-tools";

  function tool(iconName: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-tool";
    button.setAttribute("aria-label", label);
    const icon = document.createElement("span");
    icon.className = `tool-mark tool-mark--${iconName}`;
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    button.addEventListener("click", onClick);
    return button;
  }

  let erasing = false;
  const penButton = tool("pen", "画笔", () => {
    setEraser(false);
    onPenSelected();
  });
  const eraser = tool("eraser", "整笔橡皮", () => {
    setEraser(!erasing);
    onPenSelected();
  });
  function setEraser(value: boolean): void {
    erasing = value;
    eraser.setAttribute("aria-pressed", String(value));
    penButton.setAttribute("aria-pressed", String(!value));
    onEraserChange(value);
  }

  const settings = createBrushControls((brush) => {
    setEraser(false);
    onBrushChange(brush);
  });
  const photoButton = tool("photo", "照片", onChoosePhotos);
  const adjustButton = tool("arrange", "调整照片", onAdjustPhotos);
  adjustButton.disabled = true;
  let photoBusy = false;
  let hasPhotos = false;
  adjustButton.setAttribute("aria-pressed", "false");
  const undoButton = tool("undo", "撤销", onUndo);
  undoButton.disabled = true;
  group.append(penButton, eraser, photoButton, adjustButton, undoButton);
  section.append(group, settings);
  return {
    element: section,
    setPhotoMode(placing: boolean, available: boolean) {
      hasPhotos = available;
      adjustButton.disabled = photoBusy || !hasPhotos;
      adjustButton.setAttribute("aria-pressed", String(placing));
      penButton.setAttribute("aria-pressed", String(!placing && !erasing));
      eraser.setAttribute("aria-pressed", String(!placing && erasing));
    },
    setPhotoBusy(busy: boolean) {
      photoBusy = busy;
      photoButton.disabled = busy;
      adjustButton.disabled = busy || !hasPhotos;
    },
    setUndoAvailable(available: boolean) {
      undoButton.disabled = !available;
    },
  };
}

function createBrushControls(onChange: (brush: BrushSettings) => void): HTMLElement {
  let brush = defaultBrush;
  const panel = document.createElement("section");
  panel.className = "brush-panel";
  panel.setAttribute("aria-label", "画笔设置");

  const colors = document.createElement("div");
  colors.className = "brush-row";
  colors.setAttribute("role", "group");
  colors.setAttribute("aria-label", "常用颜色");

  const widthToggle = document.createElement("button");
  widthToggle.type = "button";
  widthToggle.className = "brush-width-toggle";
  widthToggle.setAttribute("aria-label", "笔画粗细");

  const custom = document.createElement("input");
  custom.type = "color";
  custom.value = brush.color;
  const customLabel = document.createElement("label");
  customLabel.className = "brush-custom";
  const customText = document.createElement("span");
  customText.className = "visually-hidden";
  customText.textContent = "自选颜色";
  customLabel.append(customText, custom);

  const colorButtons = new Map<string, HTMLButtonElement>();

  function update(next: BrushSettings): void {
    brush = next;
    for (const [color, button] of colorButtons) {
      button.setAttribute("aria-pressed", String(color === brush.color));
    }
    const thick = brush.width === brushWidths.粗笔;
    widthToggle.textContent = thick ? "粗笔" : "细笔";
    widthToggle.setAttribute("aria-pressed", String(thick));
    widthToggle.title = thick ? "点按切换细笔" : "点按切换粗笔";
    if (custom.value !== brush.color) custom.value = brush.color;
    onChange(brush);
  }

  for (const { label, color } of brushColors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "brush-swatch";
    button.setAttribute("aria-label", label);
    button.style.setProperty("--swatch", color);
    button.addEventListener("click", () => update({ ...brush, color }));
    colorButtons.set(color, button);
    colors.append(button);
  }
  widthToggle.addEventListener("click", () => update({
    ...brush,
    width: brush.width === brushWidths.细笔 ? brushWidths.粗笔 : brushWidths.细笔,
  }));

  const selectCustom = () => update({ ...brush, color: custom.value });
  custom.addEventListener("input", selectCustom);
  custom.addEventListener("change", selectCustom);
  panel.append(widthToggle, colors, customLabel);
  update(brush);
  return panel;
}
