# Tavily 常用参数

- `--query "关键词"`: 搜索词。
- `--max_results 5`: 结果数量。
- `--topic news`: 搜索类别, 也可用 `general` 或 `finance`。
- `--time_range week`: 时间范围, 常用 `day`、`week`、`month`、`year`。
- `--search_depth advanced`: 检索深度, 常用 `basic` (默认)、`advanced` (更深入, 可能增加延迟与费用)。
- `--country "united states"`: 地区偏好, `"united states"` (美国) 或 `china` (中国); 仅适用于 `--topic general`, 不是严格过滤。
- `--include_raw_content true`: 返回页面正文。
