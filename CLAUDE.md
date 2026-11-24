# ei ？

这是一本以 iPhone 为首版目标的手写涂鸦日记，计划以 PWA 交付。`memory-bank/design-document.md` 记录了已确认的产品需求、交互和真机验收条件。首版直接打开本机日记，不设登录、应用锁或云同步。当前进度以 `memory-bank/progress.md` 为准。

按设计文档实现封面、月历、阅读和编辑流程。日记包含可编辑的手写笔迹和照片，支持同日多页、离线保存以及备份恢复。验证时优先检查 iPhone 上的触摸操作和数据恢复。

技术栈见 `memory-bank/tech-stack.md`，实施步骤见 `memory-bank/implementation-plan.md`，开发进度记录在 `memory-bank/progress.md`。本文件中的路径均相对于项目根目录。

## 重要提示

写任何代码前必须完整阅读 `memory-bank/architecture.md`。

写任何代码前必须完整阅读 `memory-bank/design-document.md`。

每完成一个重大功能或里程碑后，必须更新 `memory-bank/architecture.md`。
