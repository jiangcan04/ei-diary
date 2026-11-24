# 将自己的「ei ？」部署到Cloudflare Pages

本教程适用于从GitHub源码建立新的Pages Git集成项目。源码仓库：https://github.com/jiangcan04/ei-diary 。已按作者原仓库建立https://ei-diary-check.pages.dev/并由用户验收主屏幕、离线及备份恢复；不同账号Fork流程未实测。更新和回退见[更新指南](updating.md)。

## 开始前

准备GitHub账号和Cloudflare账号。代码仓库须已有至少一个提交和分支。普通使用者不必先安装Node；Cloudflare负责安装依赖及构建。应用无需数据库服务、登录密钥或云存储。网站提供程序文件，日记仍在每台设备的浏览器里，不自动跨设备同步。

已有日记请先按[备份指南](data-and-backup.md)导出并验证备份。日常网址保持不变；新网址不会直接显示旧网址的数据。

## 1. 复制代码仓库

正式仓库公开后，打开项目GitHub页面，点击Fork，将仓库复制到自己的账号。进入自己复制出的仓库，确认package.json、package-lock.json、.nvmrc、src、public和scripts都在顶层。记录真实分支名称，可能是main或master，后续照实际选择。作者部署自己的项目时可直接选择自己的源码仓库，无须Fork自己。

## 2. 找到Pages的Git入口

登录[Cloudflare控制台](https://dash.cloudflare.com/)，进入正确账户，在侧栏Compute下找到Workers & Pages，或使用控制台搜索。

官方文档当前路径为Create application → Pages → Connect to Git。若统一创建页面优先显示Workers选项，寻找Pages标签或Continue to Pages入口，再选择连接Git。不要误选只用于上传文件的Direct Upload，也不要选择创建Hello World Worker。

界面名称可能调整，以[官方Git接入指南](https://developers.cloudflare.com/pages/get-started/git-integration/)为准。本教程根据官方文档核对，没有声称已在当前账号实测界面。

选择GitHub并授权Cloudflare GitHub应用，仅授权需要部署的仓库。看不到仓库时检查是否Fork到当前账号，以及GitHub应用是否有该仓库的访问权。

## 3. 填写构建设置

选择自己的仓库，开始设置。不要只根据框架预设自动填入的内容直接发布，核对下表：

| 配置 | 填写内容 |
|---|---|
| 项目名 | 自己选择可用的英文名称，例如ei-diary；实际网址以平台给出的为准 |
| 生产分支 | 仓库实际的main或master |
| 框架预设 | None／无，手动指定以下构建设置 |
| 根目录 | 留空，表示仓库根目录，不填src或dist |
| 构建命令 | npm run build |
| 构建输出目录 | dist |
| 环境变量 | NODE_VERSION = 26.10.0，与项目.nvmrc一致 |

不要把Cloudflare或GitHub令牌填入应用源码，也不需要为本应用配置日记数据库。构建平台需可下载项目指定的Node和npm依赖；若版本不可用，先排查平台支持，不直接忽略版本要求。

点击保存并部署，查看日志确认依赖安装、Vite构建及Service Worker生成成功。成功后使用平台提供的生产HTTPS网址；文中的示例不是已注册可用的网址。

## 4. 验证新站点

在全新浏览器环境打开生产网址，先确认封面及空月历，再建立测试混合页，保存、关闭重开并核对。浏览器网络面板检查manifest.webmanifest、fonts/long-cang-ui-v2.woff2、icons/icon-192.png及sw.js成功加载，不能返回错误或HTML冒充字体。应用当前按站点根路径提供，不配置额外子路径前缀。

在iPhone或iPad的Safari打开HTTPS网址，经分享菜单添加到主屏幕。首次联网加载后结束编辑，关闭重开，再断网验证打开、编辑与保存。打开同一网址的不同设备仍各自保存日记。iPad专项手势及触控笔体验不能仅凭网站部署成功认定通过。

恢复测试备份，确认照片、笔迹、日期及可编辑状态。完成后记录项目名、生产分支、构建设置、实际网址、测试日期、设备和各项结果。第59步前这些结果保持待验证。

## 5. 常见问题

| 现象 | 检查方法 |
|---|---|
| 没有可选生产分支 | 确认GitHub已有提交并推送；空仓库不可部署 |
| 仓库不在列表 | 检查当前GitHub账号与Cloudflare应用授权范围 |
| 找不到package.json | 根目录设为仓库根，不是src或dist |
| 构建报Node版本不符 | 检查NODE_VERSION和.nvmrc一致，再检查安装日志 |
| 构建失败 | 找第一条实际错误，先在独立环境复现，不用强制升级依赖掩盖问题 |
| 首页空白或资源404 | 输出应为dist；确认index.html、assets、fonts、icons和sw.js包含在产物中 |
| 更新后仍旧名称 | 核对生产部署对应的提交；联网结束编辑并接受应用更新后重开。旧备份文件不会自动改名 |
| 新网址日记为空 | 来源隔离是预期行为，从旧环境导出再恢复；不要清除原数据 |
| 离线打不开 | 先确认首次联网缓存成功、HTTPS正常及浏览器支持，不把开发服务当成安装验收 |

## 更新与原项目的区别

Git集成通常在推送后自动构建；Fork用户需先把上游更新同步进自己的生产分支。GitHub检查通过和Cloudflare部署成功是两个独立结果，当前工作流不自动设置部署门禁。发布前先通过检查并备份，保持同一生产网址。详细更新与回退说明安排在第60步。

现有ei-ni-kan.pages.dev按既有Direct Upload流程维护，用户已决定全部准备完成后再上传，本轮不动该项目。Direct Upload不能直接切换成Git集成，需新建Git集成项目；新项目来源变化需要手动备份迁移，不删除原项目来试图复用网址。

Git集成项目也不能简单切换为控制台拖拽上传；官方说明允许停用自动部署后使用Wrangler部署，但这不是本教程采用的流程。

## 第57步验收

先阅读教程，确认每个字段可理解，并核对package.json的build脚本、.nvmrc版本和dist资源。可在本地运行npm run build检查产物。当前不创建仓库、不执行Fork、不部署，实际完整独立部署留到第59步。待用户确认后记录本步验收，不把文档核查当成远端成功。

官方依据（2026-11-24核对）：[Git接入](https://developers.cloudflare.com/pages/get-started/git-integration/)、[Direct Upload限制](https://developers.cloudflare.com/pages/get-started/direct-upload/)、[构建设置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[构建环境](https://developers.cloudflare.com/pages/configuration/build-image/)。
