# 待办

## CLI 重构

- [x] 删除旧 MCP 的 `src/` 实现；保留 `doc/`，新 CLI 从零实现。
- [x] 建立 `platypus-cli` 包的 `platypus search <provider>` 命令，实现 Exa、Tavily、Jina、Brave、Firecrawl、Gemini、Ollama、SearXNG 的独立 adapter；仅统一 `query` 名称，其余参数及响应保持各家 API 语义。
- [x] 新增 `platypus [--env <文件>] list`，只根据所需配置输出已配置 Provider 的 JSON 名称数组，不探测上游连通性。
- [x] 完善项目级 `platypus-search` skill：八家 Provider 各有高频、排障和详细参考文件，另有按需阅读的 AI 排障文件；入口按使用场景指引读取。
- [x] 从零实现 OpenAI、Anthropic、Gemini AI 清洗、`--prompt`、OpenAI/Anthropic 可选 SDK 流式完整响应聚合和毫秒时间戳诊断文件；协议客户端放在 `src/ai/client/` 按需加载，Gemini 搜索复用 Gemini 客户端，Gemini AI 暂仅非流式。包装器不解析 Provider 后续参数。
- [ ] 从零实现域名黑白名单能力；旧黑名单代码和示例数据已随 `src/` 删除。实现前确认名单来源、白名单规则及其与 Provider 原始响应的处理方式。
- [x] 完成 typecheck、构建、lint、CLI 帮助与缺少 key 的定向验证，并验证本地安装后的 `platypus` 可执行入口；构建产物已确认按协议拆分动态 chunk。
- [x] 使用真实凭据验证 Exa 与 Tavily 原始 JSON 搜索，以及 Tavily 搜索接 OpenAI 和 Anthropic 协议的非流式、SDK 流式完整响应聚合及 AI 纯文本清洗；OpenAI 的 host 地址自动补 `/v1`。
- [x] 用真实凭据验证 Brave、Firecrawl、Ollama 搜索、Gemini 搜索 (`--model gemini-2.5-flash-lite`) 和 Gemini AI 清洗。Gemini 默认模型 `gemini-flash-lite-latest` 测试时遇到上游 503、429，未验证成功；保留用户要求的默认值。
- [ ] 使用真实 Jina 凭据及 SearXNG 实例地址验证搜索；目前没有相应测试配置，不用 mock 代替。
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
