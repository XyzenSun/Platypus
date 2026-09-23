# Brave Web Search API 说明

adapter 访问 `GET https://api.search.brave.com/res/v1/web/search`，通过 `PLATYPUS_BRAVE_API_KEY` 填 `X-Subscription-Token` Header，`PLATYPUS_BRAVE_BASE_URL` 可覆盖 `https://api.search.brave.com` 根地址。CLI `--query` 映射为 URL `q`，其他选项映射同名 URL 查询参数；不提供设置其他 Brave 专属请求 Header 的 CLI 选项。

URL 参数：`q` 必填（文档限制最多 400 字符、50 词）；`count` 控制 web 结果数（最多 20，实际可能更少），`offset` 分页；`country` 两位国家代码，`search_lang` 搜索语言，`ui_lang` 界面语言；`freshness` 接 `pd`、`pw`、`pm`、`py` 或日期区间；`safesearch` 可为 `off`、`moderate`、`strict`；`spellcheck`、`text_decorations` 是布尔值。`result_filter` 为逗号分隔的类型，如 `web`、`news`、`videos`；`extra_snippets`、`summary`、`goggles`、`include_fetch_metadata`、`operators` 等高级选项要依官方账户能力核对，不保证任意套餐可用。`summary` 返回摘要 key 不代表 CLI 能访问其他总结端点。

```bash
platypus search brave --query "JavaScript release" --count 5 --freshness pw --result_filter web
platypus search brave --query "Node.js" --country US --search_lang en --text_decorations false
```

响应 JSON 可有 `type`、`query`、`web.results`、`news`、`videos`、`infobox` 等；每项结构不相同。`result_filter web` 非 title-only。查全部参数、响应嵌套 schema、错误码及变更，请看 [Brave 官方 Web Search 参考](https://api.search.brave.com/app/documentation/web-search/get-started)；当前 CLI 不调用 Brave 的其他资源。
