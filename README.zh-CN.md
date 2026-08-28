# AI Shopping Assistant — DeepSeek Harness 插件

这是 AI Shopping Assistant 2.0.1 的 DSH 插件版本，用于把 Agent 已经收集到的商品、价格、店铺、评论和来源证据做确定性分析。

## 主要能力

- 按当前用户需求匹配度排序候选；
- 硬约束失败直接排除；
- 区分已确认到手价与条件优惠价；
- 会员成本纳入实际价格；
- 综合店铺、评论与证据可信度；
- 识别跨 SKU / 历史销量不确定性；
- 对模板化内容、SEO/GEO/AEO 矩阵、低活跃集中发帖、私下支付和敏感信息索取等来源风险降权；
- 预算、品类、地区、成色等发生实质变化时，返回 `full_refresh`，要求重新检查产品线，而不是只重排旧候选。

插件注册工具：`shopping_decision_analyze`。

## 兼容性

- 插件版本：`2.0.1-dsh.2`
- 按 2026 年 8 月当前 DSH developer preview 的 bundle/tool 规范编写。
- Node.js：`^22.19.0 || >=24.0.0`
- 零运行时依赖，不单独安装 `@deepseek-ai/dsh-tools`，避免与宿主产生重复实例。

## 安装

GitHub 仓库发布后：

```bash
dsh plugin --profile web add github:<OWNER>/<REPO>#v2.0.1-dsh.2
```

Headless：

```bash
dsh plugin --profile headless add github:<OWNER>/<REPO>#v2.0.1-dsh.2
```

本版本不需要 build，也没有 `prepare` 生命周期脚本。

## 卸载

```bash
dsh plugin --profile web remove dsh-ai-shopping-assistant
```

## 安全边界

插件本身不联网、不登录电商账户、不下单、不支付，也不写入用户数据。

不要向工具传入密码、短信验证码、Cookie、银行卡、支付密码等凭证。

排序结果只表示当前用户需求匹配度，不代表所谓“客观最好”。

更多英文说明见 `README.md`。
