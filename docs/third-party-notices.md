# 第三方资源与发布许可清单

状态：第53步处理中，用户已选择MIT，项目源码许可证见根目录LICENSE。不能将此文件或字体许可当作整个项目开源许可证。

## 字体

public/fonts/long-cang-ui.woff2、long-cang-ui-v2.woff2、long-cang-ui-v2.ttf在历史开发记录中标记为Long Cang子集。配套版权及完整许可见[long-cang-OFL.txt](../public/fonts/long-cang-OFL.txt)，记载上游https://github.com/googlefonts/longcang。字体与源码分开适用许可，分发时保留版权与OFL文件。

尚缺子集生成脚本、原始字体版本及可复现转换依据，不能仅凭文件名确认二进制来源。正式公开前需补齐证据或从可验证上游重新生成；本步不伪造历史生成记录。

## 图标与CSS图形

用户已明确确认：public/icons/icon-192.png、icon-512.png、apple-touch-icon.png三个应用图标，以及封面和界面装饰图形均由项目作者原创设计，随本项目采用根LICENSE中的MIT许可。本记录依据作者声明，不是独立权属鉴定；生成脚本并非原创声明的必要条件。

封面由src/cover.ts与src/cover.css组装HTML/CSS图形；纸纹和工具图形由src/visual-assets.css绘制，路灯由src/calendar-paper.css绘制。实现中未引用外部装饰图片。项目代码采用MIT，风格参考截图未包含在待提交文件中。原创来源依据上述作者确认；参考截图本身不随项目分发，也不宣称取得其再分发许可。

## 直接运行依赖

| 包 | 当前版本 | 安装包声明的许可 | 原始许可文件 |
|---|---|---|---|
| dexie | 4.4.7 | Apache-2.0 | node_modules/dexie/LICENSE |
| fflate | 0.8.3 | MIT | node_modules/fflate/LICENSE |

以上来自本机已安装包的package.json，不是全部传递依赖审计。分发构建包前须保留各包实际要求的版权及许可通知；源码保留package-lock.json。开发依赖和传递依赖按实际发布内容继续核查，不把直接依赖表当作完整清单。

## 本步验收

忽略规则排除系统文件、秘密、本机配置和约定个人数据目录；源码、测试夹具、锁文件与字体许可证必须仍可提交。新增规则不删除磁盘文件，也不能清理已提交历史。用户已确认MIT，根LICENSE已添加；资源未解决项继续阻止正式公开，不影响本地使用。

## 实测补充

详见[字体核查记录](font-audit.md)：已解析字体内部名称、版权、2.001版本及67/829字符映射，并确认新版两种格式轮廓相同。上游完整字体下载因网络失败，逐字形上游比对及历史生成参数尚未确认；不修改现有字体。
