# 第54步：干净环境独立运行验收

状态：已准备检查流程，等待用户运行。未开始第55步。此文件是开发验收说明，不代替之后的公开部署教程。

## 已核查的工程边界

.nvmrc与package.json固定Node.js 26.10.0；按该版本验收，不以LTS称呼代替验证。package-lock.json随源码复制，使用npm ci独立安装。应用使用本地字体、图标和CSS装饰，src中未发现外部网络素材或开发者本机绝对路径依赖。字体路径为/fonts，当前验收部署在站点根目录；子目录托管不属于本步支持承诺。

scripts/build-service-worker.mjs在Vite构建后预缓存HTML、脚本、样式、manifest、图片与字体；日记在IndexedDB，不需要后端服务或环境密钥。运行测试需要Playwright WebKit浏览器，它不属于npm依赖目录内自动安装的应用资源。

## 操作步骤

1. 原项目根目录运行node scripts/prepare-clean-check.mjs。命令输出一个新建的临时目录；每次路径不同，不复用之前的依赖或dist。
2. 用cd进入刚输出的完整路径。运行node --version，预期v26.10.0；版本不符先切换到.nvmrc指定版本。
3. 依次运行npm ci、npm run typecheck、npm test、npm run build。
4. 运行npx playwright install webkit安装匹配浏览器，再运行npm run test:e2e。安装需要网络；安装失败和应用测试失败分别记录，不以原目录node_modules代替。
5. 所有命令应退出成功。当前套件七项WebKit测试覆盖启动、保存、照片、离线更新、备份往返及触摸等；确认实际结果，不照抄历史通过记录。
6. 可运行npm run preview -- --host 127.0.0.1，用全新浏览器存储打开命令给出的地址。首次无记录；创建照片与笔迹混合页，保存、关闭重开，导出到文件，再在独立空白浏览器环境恢复并确认可继续编辑。不要清空日常网站的浏览器数据。
7. 检查字体、安装图标及manifest可加载；首次联网成功后离线重开应用可编辑。WebKit自动回归可验证资源与离线，但手机安装体验仍由实际设备验证。

## 复制范围与结果记录

复制器仅复制构建必需根文件、src、public、scripts和已知tests/startup.test.mjs，不复制.git、node_modules、dist、.env、个人备份目录或浏览器数据。拒绝符号链接，避免把目录外文件带入。临时目录仅用于本地验收，不是待上传GitHub的发布包；今后新增源码必须重新审阅允许列表。

Node版本：待用户填写；npm ci：待运行；类型检查：待运行；单元测试：待运行；构建：待运行；WebKit：待运行；手动混合页/备份/离线：待验证。仅准备流程不表示独立运行已经通过。用户确认第54步后再更新进度与架构。

## 第54步依赖修复补充（待用户复验）

用户安装审计发现7项漏洞后，fflate更新为0.8.3、Vitest更新为5.1.1，Workbox保持7.4.1；通过仅作用于workbox-build的overrides将glob指定为14.0.6，避免降级Workbox引入serialize-javascript漏洞。安装报告为0漏洞，类型检查与生产构建通过，预缓存10项；未运行完整单元与WebKit验收。安装脚本审批提示仍存在，当前构建成功不等于所有干净环境无需审批。

重新运行原项目的复制器生成新临时目录，不能复用旧复制品。新目录运行npm ci及npm audit，再执行上文所有检查。重点复验Vitest大版本升级后的全部单元测试，以及glob跨主版本替换后的离线资源清单与离线更新。npm audit只反映当时数据库中的已知漏洞，不是全面安全保证。
