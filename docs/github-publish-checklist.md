# 第58步：首次GitHub提交清单

状态：准备中，尚未提交或推送。建议目标为当前用户个人账号下的公开ei-diary仓库，账号归属与仓库名待用户确认。CLI检测到jiangcan04账号，但登录凭据无效，不能据此执行发布。

公开范围：源码、程序化测试、工程配置、GitHub检查、MIT及字体许可、README、公开说明与演示截图，以及memory-bank开发记录和AGENTS/CLAUDE约定。memory-bank含历史设备及部署记录；不含浏览器日记。生成提交时会使用Git配置的作者身份，需用户明确选择公开邮箱或GitHub noreply邮箱。

本次候选列表未命中常见私钥/GitHub/AWS密钥模式；这不是完整安全保证。.DS_Store、依赖、dist、本机配置及个人备份按规则排除。字体核查的历史参数及上游二进制比对限制保留在font-audit.md，不宣称已解决。

已补齐工作流YAML解析，触发条件、只读权限及8个步骤检查通过；实际GitHub正常/失败运行与重新克隆构建仍未执行。无现有远端，不覆盖任何远端内容。

## 待公开候选文件（生成时快照）

- .github/workflows/ci.yml
- .gitignore
- .nvmrc
- AGENTS.md
- CLAUDE.md
- LICENSE
- README.md
- docs/ci-checks.md
- docs/clean-environment-check.md
- docs/data-and-backup.md
- docs/deploy-cloudflare.md
- docs/font-audit.md
- docs/images/calendar.png
- docs/images/cover.png
- docs/public-release-audit.md
- docs/third-party-notices.md
- index.html
- memory-bank/architecture.md
- memory-bank/design-document.md
- memory-bank/implementation-plan.md
- memory-bank/progress.md
- memory-bank/tech-stack.md
- package-lock.json
- package.json
- public/fonts/long-cang-OFL.txt
- public/fonts/long-cang-ui-v2.ttf
- public/fonts/long-cang-ui-v2.woff2
- public/fonts/long-cang-ui.woff2
- public/icons/apple-touch-icon.png
- public/icons/icon-192.png
- public/icons/icon-512.png
- public/manifest.webmanifest
- scripts/build-service-worker.mjs
- scripts/prepare-clean-check.mjs
- src/app-title.test.ts
- src/app-title.ts
- src/app-updates.ts
- src/backup-export.test.ts
- src/backup-export.ts
- src/backup-import.ts
- src/backup-menu.ts
- src/backup-restore-controls.ts
- src/backup-zip.ts
- src/brush-settings.ts
- src/calendar-paper.css
- src/calendar-paper.ts
- src/calendar.css
- src/calendar.ts
- src/cover.css
- src/cover.ts
- src/diary-page.test.ts
- src/diary-page.ts
- src/diary-store.test.ts
- src/diary-store.ts
- src/editor-tools.ts
- src/fit-paper.ts
- src/ink-canvas.css
- src/ink-canvas.ts
- src/main.ts
- src/manual-save.test.ts
- src/manual-save.ts
- src/page-autosave.test.ts
- src/page-autosave.ts
- src/page-thumbnail.ts
- src/page-turn.css
- src/page-turn.ts
- src/paper-gesture.test.ts
- src/paper-gesture.ts
- src/paper-render.ts
- src/paper-viewport.ts
- src/photo-import.ts
- src/photo-placement.test.ts
- src/photo-placement.ts
- src/reading-page.ts
- src/stroke-hit.ts
- src/style.css
- src/tool-touch.ts
- src/visual-assets.css
- tests/startup.test.mjs
- tsconfig.json

## 余下操作

用户登录并确认归属、名称、公开范围及提交邮箱后，复查暂存内容，创建首次提交并推送。之后补真实README仓库入口，重新克隆验证独立构建，验证GitHub正常和故障检查；由用户完成正式测试验收。本步不连接Cloudflare、不更新现有网站，不开始第59步。
