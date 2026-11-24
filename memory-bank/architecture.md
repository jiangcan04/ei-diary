# 架构记录

首版已通过 iPhone 真机验收。以下记录首版架构和各步骤的文件职责。

- **应用**：原生 TypeScript、HTML/CSS 和 Vite。封面、月历、阅读、编辑共用导航状态。通过固定来源的 HTTPS 提供 PWA，Workbox 预缓存应用资源。
- **画面**：Canvas 2D 共用纸面坐标渲染笔迹、照片和预览。照片位置和笔画独立保存，阅读和编辑使用不同手势规则。
- **数据**：Dexie 管理 IndexedDB。页面使用稳定标识，保存时按页串行提交。记录日按设备本地凌晨 02:00 换日，新页创建后保留归属日。
- **迁移**：通过版本化 ZIP 手动导出及恢复。首版无账号、应用锁、后端或云同步。

参见 [技术栈](tech-stack.md) 和 [实施计划](implementation-plan.md)。每完成重大功能或里程碑后，记录实际实现及与计划的差异。

## 项目文件职责

第 1 步已核对以下文档及引用关系。

| 文件 | 作用 |
|---|---|
| [AGENTS.md](../AGENTS.md) | Codex 的项目说明，记录编码前的必读文件与架构更新要求。 |
| [CLAUDE.md](../CLAUDE.md) | Claude Code 的项目说明，与 AGENTS.md 使用同一套约定。 |
| [design-document.md](design-document.md) | 产品需求、交互和真机验收的依据，当前为 v1.5。 |
| [tech-stack.md](tech-stack.md) | 记录首版选型、技术边界及各类验证所用工具。 |
| [implementation-plan.md](implementation-plan.md) | 规定开发顺序和每一步的通过条件。 |
| [progress.md](progress.md) | 记录实际完成的步骤、已确认的验收结果和下一步。 |
| [architecture.md](architecture.md) | 记录架构职责与决策。按里程碑补充实际文件及其职责。 |

## 第 2 步验收后的工程文件

| 文件 | 作用 |
|---|---|
| [.nvmrc](../.nvmrc) | 固定开发与验收使用的 Node.js 版本。 |
| [.gitignore](../.gitignore) | 忽略本地 npm 依赖和 Vite 构建产物。 |
| [package.json](../package.json) | 记录工程依赖及开发、类型检查、构建和测试命令。 |
| [package-lock.json](../package-lock.json) | 固定依赖解析结果，供干净环境使用 npm ci 安装。 |
| [tsconfig.json](../tsconfig.json) | 为源码启用严格类型检查，类型检查不输出构建文件。 |
| [index.html](../index.html) | 静态页面骨架和移动端视口入口。 |
| [src/main.ts](../src/main.ts) | 启动浏览器入口，载入样式并渲染标题。 |
| [src/app-title.ts](../src/app-title.ts) | 提供启动页项目名称。 |
| [src/style.css](../src/style.css) | 定义最小启动页的配色与布局。 |
| [src/app-title.test.ts](../src/app-title.test.ts) | 用 Vitest 验证项目名称。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 启动生产构建的预览服务，用 Playwright WebKit 验证 iPhone 模拟尺寸下的标题和启动状态。 |

Vite 负责构建，TypeScript 独立检查类型。Vitest 检查源码逻辑，WebKit 启动测试针对构建后的页面。

## 第 3 步验收后的日记模型

| 文件 | 作用 |
|---|---|
| [src/diary-page.ts](../src/diary-page.ts) | 定义日记页、笔画与照片布局的数据结构，负责生成页面标识、计算本地日记日、改日期及投影视口坐标。 |
| [src/diary-page.test.ts](../src/diary-page.test.ts) | 验证同日与跨日页面标识、改日期、凌晨换日及缩放保留纸面坐标。 |

记录日期以本地日历日保存，创建时间以 Unix 毫秒保存。换日规则只在创建默认日期时应用，后续投影和编辑不改变页面归属。

## 第 4 步验收后的本机存储

| 文件 | 作用 |
|---|---|
| [src/diary-store.ts](../src/diary-store.ts) | 定义 Dexie 数据库版本，提供保存、读取及删除日记页的接口。页记录、照片及缩略图在事务中一起处理。 |
| [src/diary-store.test.ts](../src/diary-store.test.ts) | 用 fake-indexeddb 验证关闭重开、写入失败回滚、删除清理和旧库升级。 |
| [package.json](../package.json) 与 [package-lock.json](../package-lock.json) | 声明并锁定运行时 Dexie 和测试用 fake-indexeddb。 |

照片按页面和资源标识联合存储。缩略图是可重建的缓存，保存新内容时替换或移除旧缩略图。数据库第二版增加缩略图表，保留第一版的日记及照片。

## 第 5 步验收后的页面切换

| 文件 | 作用 |
|---|---|
| [index.html](../index.html) | 提供浏览器应用的根节点和移动端视口。 |
| [src/main.ts](../src/main.ts) | 渲染四个页面状态，保存月历正在浏览的月份及编辑入口来源。合本重开时按当前日记日期定位月份；阅读和编辑返回时保留原上下文。 |
| [src/style.css](../src/style.css) | 提供当期占位页面的居中布局、基本配色和按钮尺寸。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 固定模拟设备的时间和时区，验证构建产物能启动、四个页面可切换、返回保留月份及合本重开重置月份。 |

当前阅读入口使用示例页验证导航。真实日记内容由后续步骤接入。

## 第 6 步验收后的封面

| 文件 | 作用 |
|---|---|
| [src/cover.ts](../src/cover.ts) | 生成封面外的日记日期和可点按书本。翻开动画结束后回调导航，减少动态效果时直接进入月历。 |
| [src/cover.css](../src/cover.css) | 绘制纸片景观、书脊和纸边，按视口限制书本尺寸。 |
| [src/main.ts](../src/main.ts) | 把独立封面组件接到现有页面切换流程。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 增加日期、封面居中及面积检查，并验证中央和边缘均可点按。 |

## 第 7 步验收后的月历

| 文件 | 作用 |
|---|---|
| [src/calendar.ts](../src/calendar.ts) | 生成周一起始的月历表格。按本地日记日期更新高亮，并提供计时器和页面事件的清理函数。 |
| [src/calendar.css](../src/calendar.css) | 定义日期网格、日期尺寸与当前日记日的绿圈。 |
| [src/main.ts](../src/main.ts) | 为当前显示的月历启动换日跟踪，离开或切换月份时清理旧跟踪。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证周一列序、闰年、跨年切换及凌晨 02:00 自动更新高亮。 |

## 第 8 步验收后的月历纸面

| 文件 | 作用 |
|---|---|
| [src/calendar-paper.ts](../src/calendar-paper.ts) | 组装月历工具栏、路灯和纸面，并为图标按钮保留可访问名称。 |
| [src/calendar-paper.css](../src/calendar-paper.css) | 控制窄屏布局、纸面与路灯的叠层，以及合本和添页图标。 |
| [src/main.ts](../src/main.ts) | 把月历纸面和现有导航回调接起来。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 检查纸面宽度、灯头和底座位置，以及两个图标按钮的名称与触控尺寸。 |

## 第 9 步验收后的添页与补记

| 文件 | 作用 |
|---|---|
| [src/calendar.ts](../src/calendar.ts) 与 [src/calendar.css](../src/calendar.css) | 将实际日期呈现为可点按的日期格，保留日期高亮。 |
| [src/calendar-paper.ts](../src/calendar-paper.ts) 与 [src/calendar-paper.css](../src/calendar-paper.css) | 容纳全局添页入口及选中日期后的已有记录和添页操作。 |
| [src/diary-store.ts](../src/diary-store.ts) | 按日期查询最新页及已有缩略图，避免加载原图。 |
| [src/main.ts](../src/main.ts) | 决定新页归属日期，管理内存草稿和已有记录的导航，离开视图时释放缩略图 URL。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证全局添页、指定日补记和已有记录日追加，并检查退出空白页不会新增持久记录。 |

## 第 10 步验收后的本地视觉资源

| 文件 | 作用 |
|---|---|
| [public/fonts/long-cang-ui.woff2](../public/fonts/long-cang-ui.woff2) 与 [许可证](../public/fonts/long-cang-OFL.txt) | 随应用分发的 Long Cang 界面字形子集及对应许可。 |
| [src/visual-assets.css](../src/visual-assets.css) | 声明本地字体和系统回退，定义纸纹与工具图形。 |
| [src/style.css](../src/style.css) 与 [src/cover.css](../src/cover.css) | 统一使用界面字体栈，封面日期继承同一字体。 |
| [src/editor-tools.ts](../src/editor-tools.ts) | 创建带可访问名称的画笔、照片和撤销图标按钮。 |
| [src/main.ts](../src/main.ts) | 加载视觉资源并把工具栏挂载到编辑页。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 检查本地字体加载，模拟字体请求失败并验证导航及图标仍可用。 |

## 第 11 步验收后的纸面输入

| 文件 | 作用 |
|---|---|
| [src/ink-canvas.ts](../src/ink-canvas.ts) | 将指针位置转换为固定纸面坐标，用 Canvas 2D 渲染笔画，完成时提交笔迹，取消时恢复已提交的画面。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 控制纸面尺寸、纸纹和画纸内的触摸行为。 |
| [src/main.ts](../src/main.ts) | 挂载编辑画纸，并将提交的笔画加入内存草稿。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 在 WebKit 中画点、横线及手写笔画，验证抬手后笔迹可见且纸边不会误触导航。 |

## 第 12 步验收后的画笔设置

| 文件 | 作用 |
|---|---|
| [src/brush-settings.ts](../src/brush-settings.ts) | 定义画笔色板、粗细与默认炭黑细笔。 |
| [src/editor-tools.ts](../src/editor-tools.ts) | 提供可展开的色板、系统取色器及粗细选择，通知编辑页设置变化。 |
| [src/visual-assets.css](../src/visual-assets.css) | 定义画笔设置面板、选中色点和白色边框。 |
| [src/main.ts](../src/main.ts) 与 [src/ink-canvas.ts](../src/ink-canvas.ts) | 在编辑会话中保存当前画笔设置，落笔时取快照，随笔画提交。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 检查常用色、自选色、粗细、深色底上的白色和旧笔迹保留。 |

## 第 13 步验收后的整笔擦除和撤销

| 文件 | 作用 |
|---|---|
| [src/stroke-hit.ts](../src/stroke-hit.ts) | 根据纸面坐标、笔宽和触摸容差查找最上层命中笔画。 |
| [src/ink-canvas.ts](../src/ink-canvas.ts) 与 [src/ink-canvas.css](../src/ink-canvas.css) | 处理落笔和整笔擦除，根据编辑会话提供的笔画重新绘制纸面。 |
| [src/main.ts](../src/main.ts) | 保存会话内的页面历史，撤销时恢复上一个页面状态。退出时丢弃该会话的历史。 |
| [src/editor-tools.ts](../src/editor-tools.ts) 与 [src/visual-assets.css](../src/visual-assets.css) | 提供橡皮切换、模式指示及撤销入口。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证落笔、整笔擦除和倒序撤销，以及重新进入编辑时的空历史。 |

## 第 14 步验收后的画纸视口

| 文件 | 作用 |
|---|---|
| [src/paper-viewport.ts](../src/paper-viewport.ts) | 定义纸面尺寸，计算双指中心、距离、缩放和平移，并将显示坐标换回纸面坐标。 |
| [src/ink-canvas.ts](../src/ink-canvas.ts) | 管理单指与双指输入的切换，以视口变换重绘。双指开始时取消未提交的笔画或擦除，直到手指全部抬起才允许重新落笔。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 模拟双指交互，检查缩放、平移、放大落笔和缩回后的位置，并检查误触笔迹。 |

## 第 15 步验收后的照片导入

| 文件 | 作用 |
|---|---|
| [src/photo-import.ts](../src/photo-import.ts) | 逐张解码照片、生成缩小的预览、估算本批所需空间并给照片安排初始纸面位置。 |
| [src/main.ts](../src/main.ts) 与 [src/editor-tools.ts](../src/editor-tools.ts) | 打开多选文件入口，在编辑会话内保留照片资源，整批完成后进入摆放模式并写入撤销历史。 |
| [src/ink-canvas.ts](../src/ink-canvas.ts) 与 [src/ink-canvas.css](../src/ink-canvas.css) | 在同一视口中先画照片，再画笔迹，并标记摆放模式。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 检查先贴三张再追加两张，以及取消选图、坏图、空间不足和撤销导入。 |

## 第 16 步验收后的独立照片摆放

| 文件 | 作用 |
|---|---|
| [src/photo-placement.ts](../src/photo-placement.ts) | 在纸面坐标中命中最上层照片，并计算移动、等比缩放及纸边约束。 |
| [src/ink-canvas.ts](../src/ink-canvas.ts) | 将摆放模式的指针事件映射为纸面坐标，转交照片拖动流程。 |
| [src/main.ts](../src/main.ts) | 管理被选中的照片、拖动预览及调整操作。拖动完成后统一提交，照片变更和笔迹共用撤销历史。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 设置照片操作区和摆放模式样式。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证独立移动、缩放和移除，检查笔迹位置及撤销顺序。 |

## 第 17 步验收后的自动保存

| 文件 | 作用 |
|---|---|
| [src/page-autosave.ts](../src/page-autosave.ts) | 串行写入页面快照，保留排队中最新的内容。写入失败后暂停，等用户重试。 |
| [src/main.ts](../src/main.ts) | 将编辑提交与撤销接到保存队列，返回前等待写入，并保留会话内的照片资源以便撤销。空白新页返回时收起草稿。 |
| [src/diary-store.ts](../src/diary-store.ts) | 通过原有 Dexie 事务写入同一页面及其新增资源，清理不再引用的照片和过期缩略图。 |
| [src/photo-import.ts](../src/photo-import.ts) | 在释放临时 URL 前把解码像素复制到预览画布，供导入和重开时绘制。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 定义保存失败提示的布局。 |
| [src/page-autosave.test.ts](../src/page-autosave.test.ts) | 验证延迟写入的顺序及失败时重试最新快照。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证立即返回后能重开、失败重试不重复建页，以及持久化 WebKit 会话中的照片恢复。 |

## 第 18 步验收后的记录日期修改

| 文件 | 作用 |
|---|---|
| [src/main.ts](../src/main.ts) | 在编辑页提供原生日期输入，按当前日记日期校验，确认后经编辑提交、撤销和自动保存流程写入。 |
| [src/diary-page.ts](../src/diary-page.ts) | 用 `changeDiaryDate` 生成只修改记录日期的页面快照，保留标识及创建时间。 |
| [src/diary-store.ts](../src/diary-store.ts) | 保存同一标识的页面时，由 IndexedDB 更新记录日期索引，使原日和目标日的查询反映新归属。 |
| [src/style.css](../src/style.css) | 定义小号日期入口与可折行的日期表单。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证拒绝未来日期、取消修改和跨月改期，核对两天的页数、原标识和重开后的拼贴。 |

## 第 19 步验收后的整页删除

| 文件 | 作用 |
|---|---|
| [src/main.ts](../src/main.ts) | 提供编辑菜单和删除确认，等待进行中的写入后删除。失败时保留编辑状态，成功后重新打开原月份。 |
| [src/style.css](../src/style.css) | 定义编辑导航及删除确认弹窗的样式。 |
| [src/diary-store.ts](../src/diary-store.ts) | 在同一事务中删除页面、照片及其缩略图。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证取消时原页完整、确认后仅删除目标页，以及刷新重开后页面仍已删除。 |

## 第 20 步验收后的月历缩略预览

| 文件 | 作用 |
|---|---|
| [src/paper-render.ts](../src/paper-render.ts) | 提供纸面坐标下的照片和笔迹绘制函数。 |
| [src/ink-canvas.ts](../src/ink-canvas.ts) | 复用笔迹绘制函数，在编辑视口下重绘。 |
| [src/page-thumbnail.ts](../src/page-thumbnail.ts) | 根据内容范围缩放并绘制小图，照片在下、笔迹在上。 |
| [src/diary-store.ts](../src/diary-store.ts) | 按月查询每日页数、最新页和缓存缩略图。 |
| [src/calendar.ts](../src/calendar.ts) 与 [src/calendar.css](../src/calendar.css) | 提供缩略图入口和同日叠页样式，保留日号操作。 |
| [src/main.ts](../src/main.ts) | 保存页面时生成缩略图，为早期记录按需生成，并在切换视图时释放图片 URL。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 核对不同内容的缩略图、同日叠页及顶图打开的具体页。 |

## 第 21 步验收后的单页阅读

| 文件 | 作用 |
|---|---|
| [src/reading-page.ts](../src/reading-page.ts) | 在同一张只读画布上切换当天各页，按当前页读取照片，切换时丢弃过期解码结果。 |
| [src/diary-store.ts](../src/diary-store.ts) | 通过日期与创建时间联合索引读取当天各页。 |
| [src/paper-render.ts](../src/paper-render.ts) | 为阅读、编辑和月历缩略图提供共用的纸面绘制规则。 |
| [src/main.ts](../src/main.ts) | 按当前页标识衔接月历、阅读和编辑，返回时恢复来源月份或选中页。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 让阅读与编辑画布使用同一纸面规格，并定义阅读页签的选中样式。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证同日三页的内容和顺序、编辑后继续阅读同一页及返回原月份。 |

## 第 22 步验收后的主屏幕安装

| 文件 | 作用 |
|---|---|
| [index.html](../index.html) | 声明主题色、Web App 清单和 iPhone 主屏幕图标。 |
| [public/manifest.webmanifest](../public/manifest.webmanifest) | 定义应用名称、安装范围、启动地址和独立显示模式。 |
| [public/icons/](../public/icons/) | 保存封面风格的主屏幕及 Web App 安装图标。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 从生产构建读取清单、解析启动地址，并验证图标可解码及尺寸正确。 |

## 第 23 步验收后的离线缓存

| 文件 | 作用 |
|---|---|
| [scripts/build-service-worker.mjs](../scripts/build-service-worker.mjs) | 在 Vite 构建后用 Workbox 生成版本化预缓存及离线导航回退。 |
| [package.json](../package.json) 与 [package-lock.json](../package-lock.json) | 接入 Service Worker 构建命令并锁定 Workbox。 |
| [src/app-updates.ts](../src/app-updates.ts) | 在生产环境注册 Worker，检测等待中的新版，用户点按后切换。编辑时隐藏更新入口。 |
| [src/main.ts](../src/main.ts) 与 [src/style.css](../src/style.css) | 传递编辑状态，提供更新按钮样式。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证网络请求中断后可重开、保存照片，以及发现新版时等待编辑结束。 |

## 第 24 步验收后的整本导出

| 文件 | 作用 |
|---|---|
| [src/backup-export.ts](../src/backup-export.ts) | 用 fflate 分块生成 ZIP，写入版本化清单及原图、预览图。 |
| [src/backup-menu.ts](../src/backup-menu.ts) | 准备备份、显示页数并接入系统分享和下载。 |
| [src/diary-store.ts](../src/diary-store.ts) | 通过同一只读事务取得页面和照片资源快照。 |
| [src/calendar-paper.ts](../src/calendar-paper.ts)、[src/calendar-paper.css](../src/calendar-paper.css) 和 [src/main.ts](../src/main.ts) | 将日记本菜单挂在月历右上角。 |
| [package.json](../package.json) 与 [package-lock.json](../package-lock.json) | 声明并锁定 fflate。 |
| [src/backup-export.test.ts](../src/backup-export.test.ts) 和 [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证分块的原图字节、清单内容、缺失资源及浏览器实际下载。 |

## 第 25 步验收后的备份恢复

| 文件 | 作用 |
|---|---|
| [src/backup-zip.ts](../src/backup-zip.ts) | 读取本应用的 ZIP32 备份，检查条目位置、大小和 CRC，分块读取资源。 |
| [src/backup-import.ts](../src/backup-import.ts) | 校验清单版本、日期、标识、笔迹、照片布局和资源引用，生成待确认的快照。 |
| [src/backup-restore-controls.ts](../src/backup-restore-controls.ts) 与 [src/backup-menu.ts](../src/backup-menu.ts) | 从月历菜单选取 ZIP，展示待恢复页数和结果，并提供确认与取消。 |
| [src/diary-store.ts](../src/diary-store.ts) | 在同一事务中合并新增页面及照片，已有标识保留本机版本。 |
| [src/main.ts](../src/main.ts) 与 [src/style.css](../src/style.css) | 刷新恢复后的月历预览，并设置确认弹窗样式。 |
| [src/backup-export.test.ts](../src/backup-export.test.ts)、[src/diary-store.test.ts](../src/diary-store.test.ts) 与 [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证 ZIP 往返、损坏拒绝、事务回滚、重复恢复和冲突保留。 |

## 第 26 步验收后的跨日阅读顺序

| 文件 | 作用 |
|---|---|
| [src/diary-store.ts](../src/diary-store.ts) | 通过联合索引读取当天有序页面及日期边界外的最近邻页。 |
| [src/reading-page.ts](../src/reading-page.ts) | 选择新旧方向的相邻页，处理首尾、跨日日期和页签状态。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 定义翻页入口的可用与禁用样式。 |
| [src/diary-store.test.ts](../src/diary-store.test.ts) 与 [tests/startup.test.mjs](../tests/startup.test.mjs) | 验证空白日期跳过、跨日正反顺序及首尾禁用。 |

## 第 27 步验收后的掀纸角交互

| 文件 | 作用 |
|---|---|
| [src/page-turn.ts](../src/page-turn.ts) | 处理两侧纸角的点按、指针捕获、拖动进度、提交阈值和取消。开启减少动态效果时直接提交有效翻页。 |
| [src/page-turn.css](../src/page-turn.css) | 用前后两张画布、纸面裁切和折角阴影表现掀角、回落及翻过的动画。 |
| [src/reading-page.ts](../src/reading-page.ts) | 把纸角连接到跨日顺序，按需绘制并解码露出的邻页。翻页提交后再更新当前页、日期及页签。 |
| [src/ink-canvas.css](../src/ink-canvas.css) | 保留画纸与页签的共用样式，翻页手势样式由独立文件负责。 |
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 核对短拖回落、长拖换页、轻点、中部横划、减少动态效果及编辑时在纸角落笔。 |

## 第 28 步首版真机验收

用户确认首版在 iPhone 17（iOS 27.2）上验收通过。验收依据为产品设计中的首版真机场景。随手记耗时和 iPad 补测结果未提供。本步只更新验收文档。

| 文件 | 作用 |
|---|---|
| [design-document.md](design-document.md) | 定义 iPhone 真机验收场景及兼容 iPad 的补测范围。 |
| [implementation-plan.md](implementation-plan.md) | 定义第 28 步的验收条件及随手记耗时目标。 |
| [progress.md](progress.md) | 记录用户确认的首版验收结果、设备和系统版本。 |

## 第 29 步验收后的统一字体

| 文件 | 作用 |
|---|---|
| public/fonts/long-cang-ui-v2.woff2 与 long-cang-ui-v2.ttf | 提供补齐界面字形的字体及兼容回退，沿用 Long Cang 许可证。 |
| src/visual-assets.css 与 src/style.css | 声明新版字体并统一表单控件的字体继承。 |
| index.html | 预加载新版 WOFF2 字体。 |
| scripts/build-service-worker.mjs | 预缓存字体及 TTF 回退资源。 |
| tests/startup.test.mjs | 核对字体加载、实际文字测量、控件继承及加载失败时的导航。 |

## 第 30 步验收后的紧凑顶栏

| 文件 | 作用 |
|---|---|
| src/main.ts | 组装阅读、编辑的顶栏，衔接返回、小日期、菜单和当前日期添页。 |
| src/reading-page.ts | 将同日页签放在画纸前，日期由顶栏容纳。 |
| src/style.css | 定义紧凑顶栏、操作区和小日期的样式。 |
| tests/startup.test.mjs | 验证标题隐藏、顶部返回与添页归属，落笔时读取当前画纸位置。 |

## 第 31 步验收后的常驻工具栏

| 文件 | 作用 |
|---|---|
| src/editor-tools.ts | 直接排列笔设置和照片、撤销，维护画笔与橡皮选中状态。 |
| src/visual-assets.css | 定义单行工具栏、横向滚动、橡皮图标及选中样式。 |
| src/main.ts | 将工具栏挂载到编辑画纸上方。 |
| tests/startup.test.mjs | 验证工具栏常驻、单行、横向访问及切换工具后的落笔。 |

## 第 32 步验收后的照片操作

| 文件 | 作用 |
|---|---|
| src/editor-tools.ts | 提供照片导入及调整入口，反映摆放模式。 |
| src/main.ts | 按照片选择状态显示操作区，管理退出摆放与统一撤销。 |
| src/visual-assets.css 与 src/ink-canvas.css | 绘制摆放图标，将照片操作栏浮在画纸上方以稳定拖动坐标。 |
| tests/startup.test.mjs | 核对显隐、摆放操作，以及选中时画纸位置稳定。 |

## 第 33 步验收后的大画纸

| 文件 | 作用 |
|---|---|
| src/ink-canvas.css | 定义可滚动的80%动态视口，保持纸面比例与原坐标。 |
| src/paper-scroll.ts | 将编辑时的双指移动映射到纸面视口滚动。 |
| src/main.ts 与 src/reading-page.ts | 在编辑和阅读画纸外挂载视口容器。 |
| tests/startup.test.mjs | 检查尺寸、比例、纸面坐标及滚动后纸角命中，保留实际翻页交互验证。 |

## 第 34 步验收后的作品月历

| 文件 | 作用 |
|---|---|
| src/calendar.ts | 在同一日期按钮内显示作品预览，保留日期和页数辅助名称，维护今日作品标记。 |
| src/calendar.css | 隐藏作品日号、扩大缩略图、显示叠页及今日绿边框。 |
| src/main.ts | 接通作品直接阅读，恢复备份后重建月历预览状态。 |
| tests/startup.test.mjs | 验证日号显隐、格内占比、今日样式及直接阅读路径。 |

## 第 35 步验收后的改版回归

用户确认第 35 步通过，界面改版第 29 至 35 步完成。本轮验收依据用户反馈，设备型号及系统版本未另行提供。

| 文件 | 作用 |
|---|---|
| [tests/startup.test.mjs](../tests/startup.test.mjs) | 回归字体、常驻工具、大画纸、作品月历、保存、备份、跨日及翻页，补充离线重开后字体加载的断言。 |
| [implementation-plan.md](implementation-plan.md) | 保存改版步骤和本轮复验表，记录用户整体确认的结果。 |
| [progress.md](progress.md) | 记录第 35 步及整轮界面调整的验收完成状态。 |

## 第 36 步验收后的适屏居中

| 文件 | 作用 |
|---|---|
| src/fit-paper.ts | 计算顶栏、工具栏、页签和安全区后的工作高度，观察布局变化并释放监听。 |
| src/ink-canvas.css | 在工作区域内按3:4比例完整居中纸张。 |
| src/main.ts | 在阅读和编辑渲染后启动适屏计算，切换视图时清理观察器。 |
| tests/startup.test.mjs | 核对整张纸可见、居中、比例与初始无溢出。 |

## 第 37 步验收后的统一手势

| 文件 | 作用 |
|---|---|
| src/paper-gesture.ts | 管理双指缩放平移、手指退出与适屏恢复，调用共用纸面变换计算。 |
| src/ink-canvas.ts | 使用共用手势，取消未提交的画笔、擦除及照片拖动后再缩放。 |
| src/reading-page.ts | 将同一视野变换用于主纸、邻纸、照片及笔迹。 |
| src/main.ts 与 src/ink-canvas.css | 移除外层滚动手势并限制纸面区域的浏览器默认触摸行为。 |
| src/paper-gesture.test.ts 与 tests/startup.test.mjs | 验证手指状态、缩回适屏、阅读缩放及外层滚动稳定。 |

## 第 38 步验收后的整页恢复

| 文件 | 作用 |
|---|---|
| src/fit-paper.ts | 在可用区域尺寸变化时触发纸面恢复。 |
| src/main.ts | 在阅读与编辑顶栏提供整页按钮。 |
| src/ink-canvas.ts 与 src/reading-page.ts | 接收恢复事件，清理手势并重新绘制；阅读时维护纸角状态。 |
| src/page-turn.css | 禁用放大状态下的纸角指针操作。 |
| tests/startup.test.mjs | 验证整页恢复、纸角禁用及横竖屏变化后重新适屏。 |

## 第 39 步验收后的固定工具栏

| 文件 | 作用 |
|---|---|
| src/editor-tools.ts | 固定排列操作工具和笔设置，提供细粗切换及照片调整可用状态。 |
| src/visual-assets.css | 定义第一行五个操作入口，笔设置在窄屏自动换行，保留44像素触控尺寸。 |
| tests/startup.test.mjs | 验证常规两行、小屏三行、无横向溢出及粗细切换。 |

## 第 40 步验收后的工具触摸隔离

| 文件 | 作用 |
|---|---|
| src/tool-touch.ts | 捕获工具区指针，区分点按和滑动，抑制多指、取消及长按产生的误选。 |
| src/editor-tools.ts 与 src/main.ts | 为工具栏和照片操作区挂载隔离逻辑。 |
| src/visual-assets.css | 禁用工具区域的默认滚动、文字选择和长按菜单。 |
| tests/startup.test.mjs | 验证实际指针跨区拖动及照片浮层操作后纸面与工具状态稳定。 |

## 第 41 步验收后的单图落点

| 文件 | 作用 |
|---|---|
| src/paper-viewport.ts 与 src/ink-canvas.ts | 提供当前可见纸面范围及整页恢复接口。 |
| src/photo-placement.ts | 按当前视野计算等比照片尺寸和中心位置。 |
| src/main.ts 与 src/ink-canvas.css | 导入后选中新照片，提示浮在工作区域内以保持视野。 |
| src/photo-placement.test.ts 与 tests/startup.test.mjs | 验证放大纸边落点、照片比例、视野保持和自动选中。 |

## 第 42 步验收后的多图摆放

| 文件 | 作用 |
|---|---|
| src/photo-placement.ts | 按当前可见纸面为每批新图计算并排或错开布局。 |
| src/main.ts | 批量导入及追加共用可见布局，必要时恢复整页并选中最后一张。 |
| src/photo-placement.test.ts 与 tests/startup.test.mjs | 验证多图可见、比例、旧内容保持以及保存和撤销。 |

## 第 43 步验收后的月历尺寸

| 文件 | 作用 |
|---|---|
| src/calendar-paper.css | 月历宽度为94%、最大52rem，靠上排列，纸面与路灯场景占安全区内动态高度70%。菜单继续绝对定位，不影响场景位置。 |
| src/calendar.css | 星期栏固定高度，日期行平分剩余纸面高度；日期按钮覆盖格子，作品继续保留格内边距及叠页。 |
| tests/startup.test.mjs | 增加五行和六行月份、窄屏、横屏与电脑宽高、均匀格高、无横向溢出和菜单位置稳定检查。 |

尺寸调整仅影响显示布局，不改变日记数据、缩略图生成或日期操作。用户已确认第43步测试通过。

第43步回归修正：`tests/startup.test.mjs` 在恢复手机尺寸后，等待画纸与 visualViewport 连续四帧稳定，再记录工具区滑动前的几何基准；超时仍报错。工具滑动后的尺寸、笔迹和选中状态严格比较继续保留，避免把异步适屏误判为工具触摸引发的移动。用户已确认复测通过。

## 第 44 步验收后的回归测试

用户已确认修复后第44步测试通过。第36至44步本轮调整完成，未开始后续步骤。

| 文件 | 作用 |
|---|---|
| tests/startup.test.mjs | 五项回归覆盖主流程及备份、自动保存失败重试、离线更新、跨日翻页、原生触摸落笔与重开。新增用例在390与320像素视口按实际屏幕坐标触摸，核对可信touch事件、笔色、撤销、阅读和编辑恢复；返回失败输出点击、保存及页面状态。 |
| implementation-plan.md | 保留本轮复验清单和用户确认状态，区分已确认的测试与未提供的真机明细。 |
| progress.md | 记录第44步通过和本轮完成边界。 |

新增用例每种屏宽使用独立临时持久化WebKit profile，finally关闭整个context。WebKit非持久化环境拒绝IndexedDB Blob写入，纯笔迹页也有Blob缩略图，因此保存测试必须采用持久化环境；不能通过跳过缩略图或模拟成功规避。此次返回失败的根因是测试环境，先前触摸时序调整不是保存失败的根因。

原生点按保留浏览器命中检测与指针捕获，不直接派发合成事件。测试在撤销由禁用变为可用后确认笔画提交，并按实际触摸纸面坐标验证重开内容；颜色容许2级栅格量化差异。按钮按角色与辅助名称定位，返回图标视觉文本为‹，名称为「返回」。

已有合成双指测试用于状态机验证，不能代替真机手感。本次仅收到用户测试通过确认，未另行提供真机设备、系统、逐项结果及部署信息；历史iPhone17、iOS27.2不作为本轮实测记录。

## 第45步验收后的预览边界

| 文件 | 作用 |
|---|---|
| src/calendar.ts | 按月份计算实际周数，提供明确行数；为作品图片添加独立的calendar-preview-content裁切容器，保留原日期按钮和辅助名称。显式表格角色保证网格布局后的辅助语义。 |
| src/calendar.css | 用明确的网格轨道分配星期栏和日期行高度，避免绝对定位子元素依赖Safari表格百分比高度；日期格裁切溢出，预览四边留5像素，图片在独立容器内等比显示。现有叠页及今日样式沿用。 |
| src/main.ts | 恢复备份并重载预览时清理整个旧预览容器，避免残留空壳。 |
| tests/startup.test.mjs | 对实际作品检查容器内边距、图片边界和裁切；在五行、六行月份切换窄屏和横屏复核，保留打开对应日记的既有流程。 |

本步代码检查发现原布局同时依赖表格单元格内的绝对定位与按钮内部百分比图片高度，且无内容裁切层。现已消除该布局依赖，具体真机截图问题须用户复验。仅实施第45步，未实施第46步的缩略图重建或内侧叠页改版；未改变存储数据。用户已确认第45步测试通过。

## 第46步验收后的内侧叠页

| 文件 | 作用 |
|---|---|
| src/page-thumbnail.ts 与 src/paper-render.ts | 沿用已有合成流程：同一等比变换先画照片再画笔迹，生成每页一张缩略图，保持相对位置；无需改写原页或批量重建缓存。 |
| src/calendar.css | 用两个格内伪元素替换向外延伸的叠页阴影，顶图向内偏移4像素；独立内容层置于纸边前，预览按钮裁切溢出。今日框继续沿预览按钮内侧绘制。 |
| tests/startup.test.mjs | 扩展实际作品检查，验证单张合成图片等比显示、单页无纸边、多页恰有两层且内偏移、今日框向内；沿用混合色像素、保存重开及备份往返检查。 |

旧缩略图本身已经合成内容；第45步解决显示定位，第46步只调整格内叠页，沿用旧缓存和缺失缓存时按原页生成的流程，不改动持久化数据。用户已确认第46步测试通过。

## 第47步验收后的固定保存入口

| 文件 | 作用 |
|---|---|
| src/main.ts | 编辑顶栏保留返回、日期、整页和菜单，新增固定保存占位及可访问名称、说明。入口灰显，现有自动保存和返回保存不变，未显示已保存或接入手动提交。 |
| src/style.css | 编辑顶栏使用44像素返回列、可用日期列及操作列，保存槽固定5rem宽、44像素高，预留保存状态文字空间。只影响编辑顶栏。 |
| tests/startup.test.mjs | 在常规、小屏、横屏检查顶栏按钮可见、至少44像素、不重叠或横向溢出；临时变更保存状态文字验证工具栏和画纸几何稳定，随后还原。 |

第47步仅建立入口和布局：保存暂为原生disabled按钮，辅助名称为保存，说明当前自动保存及返回前写入；第48步才启用手动保存和状态。用户已确认第47步测试通过。

## 第48步验收后的手动保存

| 文件 | 作用 |
|---|---|
| src/manual-save.ts | 管理手动确认状态，调用已有串行队列schedule与flush。保存中忽略重复请求，等待更新快照写入，空白新页与进行中手势不触发手动提交；失败不显示成功。 |
| src/manual-save.test.ts | 验证延迟写入期间的新修改、重复请求、串行顺序、空白页、未完成操作及失败不误报成功。 |
| src/main.ts | 启用保存按钮，接入当前已提交快照，显示保存中、已保存及空白或操作未结束提示。新修改撤去旧成功提示，成功约1.8秒恢复保存，保存后留在编辑页；使用原自动保存队列，不另建写入通道。 |
| src/paper-gesture.ts 与 src/ink-canvas.ts | 暴露当前手势、笔画、擦除及照片拖动是否仍进行中，供保存确认判断，不改变原有提交规则。 |
| src/style.css | 提示浮在固定保存槽下方，不占用文档流、不改变画纸尺寸。 |
| tests/startup.test.mjs | 保存入口改为可用断言；新增第六项回归，覆盖空白页不建页、慢保存不提前成功、继续落笔与改日期、保存留在画纸、重开后混合内容及页数不重复。 |

第48步未修改原有失败重试和返回保存流程，失败时沿用原重试入口；第49步再统一失败入口与返回反馈。用户已确认第48步测试通过。

## 第49步验收后的失败与返回反馈

| 文件 | 作用 |
|---|---|
| src/manual-save.ts | 显式保存时可调用已有队列retry，恢复失败后的最新快照，手动保存与原重试按钮共用同一控制器。 |
| src/main.ts | 自动或手动写入失败均显示顶部保存失败；该按钮及原重试入口共用保存队列。保留错误状态直至重试。返回加进行中保护与单次导航锁，等待写入后按来源返回；失败恢复编辑及焦点。 |
| src/style.css | 错误提示和重试放在保存槽下的绝对定位浮层，显隐不占纸面布局；浮层触摸沿用工具区隔离。 |
| src/manual-save.test.ts | 验证失败队列重试保存最新快照，成功状态不会越过写入错误。 |
| tests/startup.test.mjs | 增加第七项，注入持续写入失败，检查手动保存及返回均保留页面、失败重试不移动布局；解除故障后重开，再检查离线延迟保存与重复返回只导航一次。旧测试继续验证原重试入口。 |

原始草稿、笔迹与照片不会因失败清空。返回等待时应用面板inert防误操作，同时用leaving标志阻止重复事件；写入失败解除inert并聚焦重试。保存失败状态文字及提示位于预留槽或浮层内，不改变适屏空间。用户已确认第49步测试通过。

## 第50步验收后的改版回归

| 文件 | 作用 |
|---|---|
| tests/startup.test.mjs | 保留七项端到端回归及持久化WebKit存储环境。补充390与320像素视口原生触摸点保存后留在编辑页；备份恢复后检查预览边界与内侧叠页，再手动保存新增笔迹，后续重复恢复仍保留本机版本。 |
| implementation-plan.md | 增加第50步测试覆盖映射、四条命令、原地址更新步骤及本轮真机复验表，结果暂不填写。 |
| progress.md | 记录第49步验收及第50步等待测试的状态。 |

本步没有新增产品功能或修改存储结构。自动化不替代Safari与主屏幕App的相册、触摸手感及系统分享复验。未运行完整测试，未自动部署，也未将历史设备信息或旧通过结果作为本轮真机证据；用户已确认第50步测试通过，未开始第51步。

## 产品更名为ei？

| 文件 | 作用 |
|---|---|
| src/app-title.ts、index.html、public/manifest.webmanifest | 使用ei？作为应用、浏览器及安装显示名称，index额外声明iPhone主屏幕标题。 |
| src/backup-menu.ts、src/backup-restore-controls.ts | 同步备份文件名与错误提示中的产品名。 |
| package.json、package-lock.json | npm项目名称为ei，符合包名字符要求。 |
| src/app-title.test.ts、tests/startup.test.mjs | 同步标题、清单及备份提示的既有断言。 |
| AGENTS.md、CLAUDE.md、design-document.md、tech-stack.md、implementation-plan.md | 同步当前产品文档标题。 |

持久化身份继续使用ei-ni-kan数据库、ei-ni-kan-backup版本1及原缓存标识，保留现有Manifest id与来源地址。显示名称改变不迁移或清空旧日记，旧备份继续可恢复。工作目录保持原路径。本次未自动部署，更名尚待构建和设备更新。


## 第51步验收后的公开前审计

用户确认第51步通过。docs/public-release-audit.md负责记录公开候选文件、Git状态、扫描方法与限制、素材依据及待解决项，不作为运行期资源或发布授权。progress.md记录用户验收，implementation-plan.md继续约束后续步骤。源码与浏览器IndexedDB日记分开；无提交历史时不得声称完成历史秘密清理。此步未改应用代码、未删除个人文件、未公开仓库。

第52步正在将当前显示名称调整为「ei ？」；上节无空格名称为历史更名记录，第52步验收后再补充其最终文件职责与结果。


## 第52步验收后的显示名称

用户确认第52步通过。src/app-title.ts提供「ei ？」；index.html声明网页及Apple主屏幕标题；public/manifest.webmanifest声明安装名称；src/backup-menu.ts与src/backup-restore-controls.ts同步文件名及提示。src/app-title.test.ts及tests/startup.test.mjs同步既有断言。项目说明及当前产品文档标题同步。数据库ei-ni-kan、备份格式ei-ni-kan-backup、缓存标识、manifest身份与部署来源沿用；更名不触发数据迁移。第53步验收后再记录其最终文件职责。


## 第53步验收后的公开资源边界

用户确认第53步通过。.gitignore排除系统、本机配置及个人导出；LICENSE提供用户选定MIT，package.json与锁文件同步根包许可。docs/third-party-notices.md记录第三方与原创声明；docs/font-audit.md保存字体元数据、映射数量、格式轮廓比对及哈希；docs/public-release-audit.md保留历史审计和来源补充。字体OFL独立于MIT，作者确认的图标/封面/装饰采用MIT。上游字体下载失败，历史生成方法未知，这些限制继续保留；未修改字体数据。第54步待验收，文件职责在用户确认后补充。


## 第54步验收后的独立构建边界

用户确认第54步通过。scripts/prepare-clean-check.mjs按允许列表复制到新临时目录，拒绝符号链接，不带依赖、dist或个人导出；docs/clean-environment-check.md记录安装、构建、WebKit、离线及备份验收方法。package.json与package-lock.json固定fflate 0.8.3、Vitest 5.1.1，Workbox保持7.4.1并限定glob override 14.0.6。降级Workbox曾引入其他漏洞，最终未采用；当次审计0漏洞，未来仍需复查。字体路径当前要求站点根部署。应用数据结构与备份格式未改变。


## 第55步验收后的使用说明

用户确认第55步通过。README.md是公开项目入口，说明定位、使用、开发、现有体验网址及未完成部署入口；docs/data-and-backup.md负责数据隔离、离线、保存失败、导出恢复、冲突去重及迁移解释。docs/images/cover.png和calendar.png来自独立空白WebKit会话，不含真实个人日记，不属于应用运行资源。只改文档未改数据模型或部署。


## 第56步验收后的自动检查配置

用户确认第56步通过。.github/workflows/ci.yml监听push、pull_request与手动触发，在Ubuntu 24.04按.nvmrc设置Node，锁文件安装后顺序执行类型、单元、构建及WebKit检查。仅contents只读，不保留checkout凭据、不部署。docs/ci-checks.md记录本地验收及第58步待补远端正常/失败验证。此前专用YAML解析未完成，保持记录，不声称远端已经运行。


## 第57步验收后的部署教程

用户确认第57步通过。docs/deploy-cloudflare.md规定站点根部署、npm run build与dist输出、固定Node版本、Git授权和备份迁移；README提供教程入口。教程不创建云端数据库，不承诺跨设备同步。现有Direct Upload来源保持，Git集成独立项目的真实验证待第59步。第58步补充YAML语法解析及基本配置检查通过，远端运行仍待验证。


## 第58步远端检查结果（独立克隆验收待完成）

用户截图确认main提交f9f97f2的Project checks #3成功。工作流已使用checkout/setup-node v6，项目Node版本仍由.nvmrc决定。tests/startup.test.mjs离线重开先创建替代页再关闭原页，避免持久化WebKit零页面生命周期风险；page-turn.ts在交互时读取减少动态效果偏好。docs/ci-checks.md记录故障与验证边界。GitHub Desktop使用Documents/GitHub/ei-diary克隆，原开发目录仍保留，后续改动需明确同步，避免测试和上传不同版本。远端重新克隆构建尚待完成，不推断第59步部署已执行。


## 第58步独立克隆验证结果

从公开远端重新克隆f9f97f2，在独立目录使用npm ci安装，未复制原node_modules或dist。类型、22单元、构建与七项WebKit全部通过，预缓存10资源；系统Playwright浏览器安装沿用本机工具缓存，不将其描述为全新操作系统验收。结合GitHub Linux远端成功结果，已验证代码可独立取得与构建，等待用户最终验收。仍未部署网站或实施第59步。


## 第58步最终验收

用户确认第58步通过，实际公开仓库为jiangcan04/ei-diary，main提交f9f97f2已在GitHub运行成功，并从远端独立克隆通过类型、22单元、构建及七项WebKit。公开源码和部署应用分开；浏览器日记未上传。第59步独立来源需新Pages项目；严格Fork复验需不同拥有者，作者原仓库直接部署不冒充Fork证据。
