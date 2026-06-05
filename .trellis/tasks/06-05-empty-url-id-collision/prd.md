# Fix empty URL ID collision in search results

## Goal

修复 search 结果在 `hasContent=true` 且上游未返回 `url` 时的身份冲突问题，避免 RRF 将本应独立的结果错误合并；同时明确 `hasContent=false` 与 `hasContent=true` 两种模式下空 URL 的处理约束，并形成可审查的修复方案。

## What I already know

* 当前 `SearchResult.id` 不是上游直接返回，而是在 RRF 聚合阶段由 `normalizeUrl(r.url)` 生成。
* 当前 RRF 去重 key 与最终输出 `id` 使用同一个 canonical 值，位置在 `src/aggregator/strategies/rrf.ts`。
* 当前 `normalizeUrl(raw)` 在 `new URL(raw)` 失败时会直接返回原始字符串；因此空字符串 `''` 会原样返回。
* 当前 Tavily / Exa adapter 都使用 `.filter((r) => params.hasContent || Boolean(r.url))`。
* 这意味着：
  * `hasContent=false` 时，空 `url` 结果会被过滤。
  * `hasContent=true` 时，空 `url` 结果会被保留。
* 当多个空 `url` 结果进入 RRF 时，它们都会得到相同 canonical key `''`，从而被当作同一条结果合并；这会导致 `sources`、`score`、`title/content` 合并结果失真。
* Gemini 不受这个问题影响，因为它始终返回固定 sentinel URL：`GEMINI_SUMMARY_URL`。
* 现有测试已明确覆盖当前行为：`tests/unit/search-adapters.test.ts` 中有 “keeps empty-url results when hasContent=true” 的断言，因此修复会需要同步更新测试与行为描述。

## Assumptions (temporary)

* 本任务只讨论 search 结果身份与去重语义，不改 fetch 流程。
* 本任务优先保持 `hasContent=true` 时“允许保留空 URL 结果”的产品意图，但要修复其错误合并问题。
* 如果需要新增内部 identity 字段或 fallback key，应尽量避免把“随机性”引入到同一次请求中的不稳定排序/测试波动。

## Open Questions

* 暂无阻塞性开放问题；待审查实现时可再讨论 hash 长度、编码格式与是否抽取公共 helper。

## Requirements (evolving)

* 任何非 Gemini 渠道，在 `hasContent=false` 时都必须过滤空 `url` 结果。
* 在 `hasContent=true` 时，空 `url` 结果不能再因为共享空字符串 key 而被 RRF 错误合并。
* 当 `hasContent=true` 且 `url` 为空时，采用**基于内容派生的稳定 ID** 作为 fallback identity。
* fallback identity 的输入使用 `provider + title + content`：
  * `title` 缺失时按 `null` 参与哈希。
  * `content` 缺失时按 `null` 参与哈希。
* fallback identity 使用 Node 内置 `crypto.createHash('sha256')` 生成，不新增额外依赖。
* fallback identity 需要带可读前缀，格式为：`missing-url-<provider>-<hash>`。
* 如果同一 provider 下多条结果同时缺失 `url/title/content`，它们可能得到相同 fallback identity 并被合并；这是可接受的退化行为。
* fallback identity **同时作为最终返回的 `SearchResult.id`**：
  * 有 `url` 时：`id = canonical url`
  * 无 `url` 时：`id = missing-url-<provider>-<hash>`
* RRF 内部去重 key 与最终返回 `SearchResult.id` 必须保持同一语义，避免内部 identity 与外部 `id` 分叉。
* Gemini 继续使用固定 sentinel URL，不纳入这次空 URL fallback 方案变更范围，除非评审后明确决定统一语义。
* identity 生成逻辑应集中在聚合/RRF 层或统一 helper 中，不下沉到各 provider adapter 中分散维护。
* 更新相关 unit/e2e 测试与 spec/doc 描述。

## Acceptance Criteria (evolving)

* [ ] `hasContent=false` 时，非 Gemini 渠道空 `url` 结果会被过滤。
* [ ] `hasContent=true` 时，两个不同的空 `url` 结果不会再因为共享 `''` 而被 RRF 合并。
* [ ] 对于空 `url` 结果，fallback identity 使用基于 `provider + title + content` 的稳定派生值。
* [ ] `title` 或 `content` 缺失时，按 `null` 参与 fallback identity 计算。
* [ ] fallback identity 使用 `sha256` 生成，且不引入新依赖。
* [ ] fallback identity 输出格式为 `missing-url-<provider>-<hash>`。
* [ ] 同一 provider 下同时缺失 `url/title/content` 的结果允许退化合并，并在 PRD 中明确说明。
* [ ] `SearchResult.id` 与 RRF 内部去重 key 语义一致：有 `url` 时为 canonical url，无 `url` 时为 `missing-url-<provider>-<hash>`。
* [ ] `sources`、`score`、`rank` 不会因为空 `url` 身份碰撞而失真。
* [ ] Tavily / Exa / RRF 相关单元测试更新并覆盖该场景。
* [ ] 如果对外 schema 或 `id` 语义有变化，相关 spec/doc 同步更新。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不在本任务中重新设计整体 RRF 算法。
* 不在本任务中修改 Gemini 的 sentinel URL 方案。
* 不在本任务中引入新的 search 输出业务字段，除非评审后认为 identity 修复必须如此。
* 不处理 fetch provider 的 URL 身份问题。

## Technical Notes

* `src/aggregator/strategies/rrf.ts`
  * `const canonical = normalizeUrl(r.url)` 既用于 dedup key，也用于最终 `id`。
* `src/lib/url.ts`
  * invalid/raw URL fallback 为 `return raw`，因此空字符串会保留为空字符串。
* `src/providers/tavily.ts`
  * `hasContent=true` 时保留空 URL 结果。
* `src/providers/exa.ts`
  * `hasContent=true` 时保留空 URL 结果。
* `src/providers/gemini.ts`
  * Gemini 总是返回固定 `GEMINI_SUMMARY_URL`，不依赖上游网页 URL。
* `tests/unit/search-adapters.test.ts`
  * 已覆盖“hasContent=true 时保留空 URL 结果”的当前行为。
* `tests/unit/rrf.test.ts`
  * 当前尚未覆盖“多个空 URL 结果发生错误合并”的回归测试，后续应补充。
