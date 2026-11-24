# 第56步：GitHub自动检查

.github/workflows/ci.yml在push、pull_request及手动触发时运行。适用任意分支名称，便于当前master及未来Fork。Ubuntu 24.04运行器根据.nvmrc安装Node.js 26.10.0，npm ci使用锁文件；缓存仅缓存npm下载，不复用node_modules或旧dist。

依次执行类型检查、单元测试、生产构建、安装WebKit与Linux依赖、生产端到端回归。任一步失败默认停止后续步骤并将任务标红，不使用continue-on-error或忽略退出码。20分钟超时避免卡住；同分支新运行取消旧运行。

工作流仅有contents: read，checkout不保留凭据。不需要用户配置部署令牌或其他秘密，不上传产物、不部署网站。使用pull_request而非pull_request_target处理外部贡献。

## 当前本地验收

在项目根目录依次运行npm ci、npm run typecheck、npm test、npm run build、npx playwright install webkit、npm run test:e2e。Linux运行器另用--with-deps安装系统依赖。Mac本地通过并不能证明Ubuntu远端通过。

打开ci.yml核对触发条件、Node版本来源、锁文件安装、先构建后端到端顺序、只读权限及无部署步骤。本次未运行完整测试，由用户验收。

## 仓库建立后的远端验证（第58步补齐）

当前尚无GitHub远端仓库，本步仅配置完成，远端运行待验证。首次推送后打开Actions，检查Project checks的每个步骤成功。通过后在临时分支引入一个可恢复的TypeScript类型错误并发起测试PR，确认检查失败、后续步骤未误报通过；撤销该错误后再次确认通过，随后关闭测试PR。不向正式分支合入故障。失败注入需在届时授权范围内执行，不能把本地模拟退出码当成远端验证证据。

需要GitHub禁止失败检查合并时，在仓库建立且检查实际运行后单独配置分支保护；本工作流本身不自动设置保护。无仓库时不预填成功结果。

依据：[setup-node](https://github.com/actions/setup-node)、[checkout](https://github.com/actions/checkout)、[Playwright CI](https://playwright.dev/docs/ci)。

## 第58步Linux WebKit复验修正

截图中的取消运行由同分支新任务触发concurrency规则，不代表断言失败。另一运行离线用例在关闭唯一页面后newPage报上下文关闭；改为先建替代页再关闭原页，避免零页面窗口。保留断网、照片重开、编辑期间不更新及更新后内容断言；加入上下文关闭/页面崩溃诊断。不能仅凭截图确定浏览器进程退出的底层原因。

actions/checkout与setup-node升级到官方v6，其内部运行时为Node24；项目仍按.nvmrc使用26.10.0。YAML解析通过，本地独立离线测试通过，重新构建后完整七项WebKit通过。Linux GitHub远端复验待上传，不将Mac通过等同Linux通过。
