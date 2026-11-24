import type { Stroke } from "./diary-page";

export type BrushSettings = Pick<Stroke, "color" | "width">;

export const brushColors = [
  { label: "嫩绿", color: "#b7cf82" },
  { label: "柔和绿", color: "#8da581" },
  { label: "苔绿", color: "#65784c" },
  { label: "深松绿", color: "#294c3b" },
  { label: "炭黑", color: "#252322" },
  { label: "白色", color: "#ffffff" },
] as const;

export const brushWidths = { 细笔: 4, 粗笔: 12 } as const;
export const defaultBrush: BrushSettings = { color: "#252322", width: brushWidths.细笔 };
