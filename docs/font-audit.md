# 字体核查记录

已使用FontTools实际解析三个字体文件，未修改字体或应用代码。

| 文件 | 内部字体名 | 版本 | Unicode映射数 |
|---|---|---|---|
| long-cang-ui.woff2 | Long Cang / Regular | 2.001 | 67 |
| long-cang-ui-v2.woff2 | Long Cang / Regular | 2.001 | 829 |
| long-cang-ui-v2.ttf | Long Cang / Regular | 2.001 | 829 |

三份内部版权均为Copyright 2018 The LongCang Project Authors，并带googlefonts/longcang地址。旧WOFF2含OFL许可链接；新版未保留该name字段，但项目有独立完整OFL文本。Google Fonts官方METADATA记录字体名Long Cang、字重400、文件LongCang-Regular.ttf及同一版权主体；官方OFL文本与本地配套版权声明一致。

官方依据：
- https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/METADATA.pb
- https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/OFL.txt

新版TTF与WOFF2字符映射及所有glyf轮廓二进制比较结果：True。

## 文件指纹

- long-cang-OFL.txt: SHA-256 603546b7219a94bb59bf8294458194a5010119486354092b66a09a3fd61aeacc
- long-cang-ui-v2.ttf: SHA-256 864426072fb5d5e63c22ae5842015e6918b04e5c6fa4dc82fc131bd08c767089
- long-cang-ui-v2.woff2: SHA-256 42ec37b9868b3852eaf20b5e9a72e9e14378488cc0a7550422e403813411cc4a
- long-cang-ui.woff2: SHA-256 3dcfa92f29f14caeda37ffcad58d6323abe410807e635ff4575f3a3658281d55

## 结论与限制

内部信息支持三份文件属于Long Cang 2.001的裁剪版本，新版两种格式具有相同字符与轮廓。它们不是项目作者原创字体，继续保留OFL与版权信息。

未找到历史子集生成脚本，不能恢复当时的精确工具参数。尝试从官方GitHub下载完整TTF两次，均因网络无法连接raw.githubusercontent.com失败，所以尚未完成与上游完整字体逐字形比对，也未确认上游文件提交版本。官方网页元数据已通过网页工具核对；元数据匹配不能代替字形比对。

不伪造原始生成记录，不必因缺少历史脚本就宣称不能使用。若需要可复现发布资产，应在能下载官方字体时固定上游提交及哈希，按当前字符集合重新生成并验证字形、字宽及界面覆盖，再保留脚本。当前第53步来源核查有上述明确剩余项，未标记验收通过。
