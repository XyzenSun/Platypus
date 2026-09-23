# 待办

## CLI 重构

- [x] 删除旧 MCP 的 `src/` 实现；保留 `doc/`，新 CLI 从零实现。
- [x] 建立 `platypus-cli` 包的 `platypus search <provider>` 命令，首批实现 Exa、Tavily、Jina 的独立 adapter；普通搜索仅统一 `query` 名称，其余参数及响应保持各家 API 语义。
- [x] 从零实现 OpenAI/Anthropic AI 清洗、`--prompt`、可选 SDK 流式完整响应聚合和毫秒时间戳诊断文件；包装器不解析 Provider 后续参数。
- [ ] 从零实现域名黑白名单能力；旧黑名单代码和示例数据已随 `src/` 删除。实现前确认名单来源、白名单规则及其与 Provider 原始响应的处理方式。
- [x] 完成 typecheck、构建、lint、CLI 帮助与缺少 key 的定向验证，并验证本地安装后的 `platypus` 可执行入口。
- [x] 使用真实凭据验证 Exa 与 Tavily 原始 JSON 搜索，以及 Tavily 搜索接 OpenAI 和 Anthropic 协议的非流式、SDK 流式完整响应聚合及 AI 纯文本清洗；OpenAI 的 host 地址自动补 `/v1`。
- [ ] 使用真实 Jina 凭据验证搜索；目前没有 Jina 测试 key，不用 mock 代替。
- [ ] 发布到 npm 后验证全局安装的 `platypus search exa ...`。

## 旧聚合方案遗留事项（不直接用于 CLI，待重评估）

一:
feat: 新增一层得分计算重排层：
1.新增上游渠道权重系数，通过环境变量指定，将score =score * upstream 权重，影响rank结果，设定如下默认值
gemini 1.5
exa :
2. 域名权重，黑白名单模式，黑名单权重为0，白名单域名权重为2，其他为1，域名权重表通过github raw文件 json获取
二：
feat：结果包装层，可筛选score与rank ，只返回前X名 以及 score> x ，两个条件同时满足取交集
