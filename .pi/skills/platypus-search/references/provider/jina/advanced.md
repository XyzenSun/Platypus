# Jina `GET /search` API 说明

adapter 请求 `GET https://s.jina.ai/search`，`PLATYPUS_JINA_API_KEY` 放入 Bearer Header，可用 `PLATYPUS_JINA_BASE_URL` 覆盖根地址。请求固定 `Accept: application/json`。CLI `--query` 映射 URL 查询参数 `q`；不直接接受 `--q`；其他 `--字段 值` 转为查询参数字符串。输出原始响应文本，不做字段转换。

搜索端点参数：`q` 必填；`type` 可为 `web`、`images`、`news`；`num` 或 `count` 为结果数量，资料所列范围 0-20；`page` 是页码；`engine`、`provider` 可指定 google/bing/reader，须按账户与官方支持情况核对；`gl` 国家/地区代码，`hl` 语言代码，`location` 搜索位置；`fallback` 与 `nfpr` 为布尔参数。注意 CLI 将非字符串值转为查询串，例如布尔值为 `true` 或 `false`。涉及 `respondWith` 等 Reader 参数时，仍要核对 `/search` 是否支持与 JSON Accept 的组合，不能当作独立抓取端点使用。

```bash
platypus search jina --query "Node.js" --type web --num 5 --gl US --hl en
platypus search jina --query "Node.js release" --type news --page 2
```

响应保持 Jina 的 JSON envelope，结果结构按 API 返回，不承诺统一的标题、正文或高亮字段。CLI 未接入 `GET /{q}`、读取网页、上传文件、POST 或流式输出。完整字段、取值、响应 schema 和限制请查 [Jina Reader 官方入口](https://jina.ai/reader/) 中的 Search API 文档；以其最新 `/search` 说明为准。
