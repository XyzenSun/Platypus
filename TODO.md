# 待办

## CLI 重构

- [ ] 将 MCP 入口迁移为 `platypus-cli` 包的 `platypus` 命令，首批支持 Exa、Tavily、Jina 的独立 adapter；普通搜索仅统一 `query` 名称，其余参数及响应保持各家 API 语义。
- [ ] 保留可选 AI 清洗能力，包装器不解析 Provider 后续参数；实现前确认输出格式及失败回退行为。
- [ ] 保留域名黑白名单机制：迁移现有黑名单能力，并在实现前确认白名单规则及其与 Provider 原始响应的处理方式。目前白名单尚未实现。
- [ ] 更新 README、构建与安装说明，验证安装后可以运行 `platypus exa search ...`。

## 旧聚合方案遗留事项（不直接用于 CLI，待重评估）

一:
feat: 新增一层得分计算重排层：
1.新增上游渠道权重系数，通过环境变量指定，将score =score * upstream 权重，影响rank结果，设定如下默认值
gemini 1.5
exa :
2. 域名权重，黑白名单模式，黑名单权重为0，白名单域名权重为2，其他为1，域名权重表通过github raw文件 json获取
二：
feat：结果包装层，可筛选score与rank ，只返回前X名 以及 score> x ，两个条件同时满足取交集
