# 多平台抓取质量择优

## Goal

完成 `fetch` 抓取功能：并发调用多个已配置抓取 provider，对每个 URL 判断各 provider 是否真正抓取成功，并从成功结果中选择质量最高的一个返回，避免调用方自行比较多个 provider 结果。

## What I already know

* 当前 MCP server 提供 `list` / `search` / `fetch` 三个工具；README 标注 `fetch` 仍在优化中，当前返回多个 Provider 的结果视图。
* 支持抓取的 provider 包括 Firecrawl、Jina Reader、Tavily Extract、Exa Contents。
* 当前 `src/tools/fetch.ts` 默认 channels 使用 `DEFAULT_FETCH_PRIORITY`，目前是 `firecrawl`、`jina` 优先，再追加其它可用 fetch provider。
* 当前 `src/aggregator/fetch.ts` 已并发执行 `(url, provider)` 任务，并使用 `Promise.allSettled` 将单 provider 失败转为 warnings。
* 当前 `FetchResponse.results` 结构是 `results[url][provider] = RawFetchResult`，尚未选出 best result。
* provider 目前对 HTTP 非 2xx 会抛 `ProviderError`；部分 provider 对无结果也会抛错，例如 Tavily 无 results、Exa 无 text。
* Firecrawl/Jina 目前即便 content 为空字符串也会返回 fulfilled 结果，尚未统一判定“空内容不是成功”。

## Assumptions (temporary)

* “成功”不应只等于 HTTP 2xx / Promise fulfilled，还应要求归一化结果具备非空有效 content。
* “质量最高”可以先用可解释的启发式评分完成，而不是引入 LLM 评估。

## Research References

* [`research/fetch-provider-success-and-blocking.md`](research/fetch-provider-success-and-blocking.md) — Firecrawl/Jina/Tavily/Exa 的成功、失败、阻挡页、空内容信号研究；结论是没有统一 `isBlocked` 字段，需要结合 provider 错误字段、目标 HTTP 状态、内容/标题特征判断。

## Open Questions

* 无。用户已确认按当前 PRD 进入实现准备。

## Technical Approach

* 将 `fetch` 收敛为单 URL 输入；schema 层拒绝多个 URL。
* 聚合层仍对单个 URL 并发调用多个 provider。
* provider 报错、无结果、空内容、疑似阻挡页均视为无效候选。
* 候选质量先用可测试启发式选择：有效内容长度、标题存在、URL 匹配、provider 默认优先级等；分数仅内部使用，不返回。
* 工具返回成功时只包含 best result 与 `provider`；不返回 warnings；全部 provider 无有效结果时返回 error。

## Implementation Plan

* PR0: 抽象候选诊断模型（FetchCandidate + 有效性诊断），不改 FetchProvider 接口；为后续 best-result 聚合提供统一数据面。
* PR1: 更新 fetch 输入 schema / 类型 / 工具返回结构为单 URL best result。
* PR2: 实现有效性判定、阻挡页检测、内部质量评分与 best 选择。
* PR3: 更新单元测试、E2E 测试与 README 行为说明。

## PR0: 候选诊断模型抽象（当前要实现）

**范围边界（只抽象候选诊断模型）**：

* 不改 `FetchProvider` 接口签名，不把 `fetch()` 返回类型从 `RawFetchResult` 改成带诊断字段的类型。
* 不修改四个 fetch adapter 的现有返回行为，避免引入 breaking change 和大范围测试改动。
* 新增独立的内部诊断数据模型与纯函数接口，由聚合层在拿到 `RawFetchResult` 后转换为候选诊断对象并据此选 best。

**要新增的内部模型 / 接口**：

* `FetchCandidate`：每个 provider 对单个 URL 的抓取结果候选，包含：
  * `provider: string` — 来源 provider id
  * `result: RawFetchResult | null` — 归一化抓取结果；失败/无结果时为 `null`
  * `diagnostics: FetchDiagnostics` — 统一诊断字段
* `FetchDiagnostics`：成功/失败/阻挡的诊断信息，字段建议：
  * `success: boolean` — 是否为有效成功（成功 = 抛错为 false 且 `result` 非空且 content 非空）
  * `emptyContent: boolean` — content 是否为空或仅空白
  * `blocked: boolean` — 是否判定为被阻挡（401/403/CDN 盾/反爬验证页/登录权限页）
  * `blockReason?: string` — 阻挡原因（来源 provider 错误码、内容启发式命中类别等）
  * `httpStatus?: number` — 目标页面 HTTP 状态码，如果该 provider 文档/响应中可获取
  * `providerErrorCode?: string` — provider 抛出的 `ProviderError.code`
  * `providerErrorCategory?: string` — provider 抛出的 `ProviderError.category`
  * `providerErrorMessage?: string` — provider 抛出的错误 message
  * `notes?: string` — 其它补充说明
* `FetchCandidateBuilder`（纯函数接口）：把 `(provider, outcome)` 转换为 `FetchCandidate`，其中 `outcome` 是 `Promise.allSettled` 的结果（fulfilled 的 `RawFetchResult` 或 rejected 的 `ProviderError`/其它错误）。
* `BlockedPageDetector`（纯函数接口）：输入 `RawFetchResult` + 可选 provider 错误信息，输出 `BlockedPageSignal`（`blocked: boolean` + `reason?: string`）。
  * 判定依据（综合四家文档）：
    * provider 抛错且 `httpStatus`/错误码指向 401/403/429 + `SOURCE_NOT_AVAILABLE` 等阻挡类 tag → blocked
    * `RawFetchResult.content`/`title` 中出现常见 challenge/Cloudflare/登录/权限文案 → blocked（启发式文本匹配，可后续根据真实测试调整）
    * 空内容仅在 `BlockedPageDetector` 中作为 `emptyContent` 信号，不直接判 blocked，由上层有效性判定统一处理
* `ContentQualityScorer`（纯函数接口）：输入 `FetchCandidate`，输出 `FetchQualityScore`（`score: number` + 可选 breakdown）。
  * MVP 启发式维度（按之前确认）：
    * 有效内容长度（去空白后的字符数）
    * 是否有 title
    * 归一化 URL 与输入 URL 是否匹配
    * provider 默认优先级（`DEFAULT_FETCH_PRIORITY` 顺序）作为同分 tie-breaker
  * 分数仅内部使用，不进入对外返回结构。
* `FetchBestSelector`（纯函数接口）：输入 `FetchCandidate[]`，输出 best `FetchCandidate | null`。
  * 先按 `diagnostics.success === true` 过滤
  * 再按 `ContentQualityScorer` 分数排序
  * 同分按 provider 默认优先级 tie-break
  * 全部无效时返回 `null`，由聚合层映射为最终 error

**文件位置建议**：

* 新增 `src/aggregator/fetch-types.ts`（或 `src/aggregator/fetch-diagnostics.ts`），放 `FetchCandidate` / `FetchDiagnostics` / 诊断接口定义。
* 新增 `src/aggregator/fetch-diagnostics.ts`（或拆分多文件）放 `FetchCandidateBuilder`、`BlockedPageDetector`、`ContentQualityScorer`、`FetchBestSelector` 的默认实现。
* 不改 `src/providers/fetch-types.ts` 中的 `RawFetchResult` / `FetchProvider`。
* 不改四个 adapter 文件。

**验收**：

* [ ] 新增类型与纯函数接口可被聚合层导入使用，类型在 `tsc --noEmit` 下通过。
* [ ] `FetchCandidateBuilder` 能把 fulfilled 的 `RawFetchResult` 与 rejected 的 `ProviderError`/其它错误都映射为 `FetchCandidate`。
* [ ] `BlockedPageDetector` 至少覆盖：Exa 403/`SOURCE_NOT_AVAILABLE`、空内容、challenge/Cloudflare 文案启发式。
* [ ] `ContentQualityScorer` 按内容长度、标题存在、URL 匹配、provider 优先级产出可解释分数。
* [ ] `FetchBestSelector` 在全部无效时返回 `null`，在存在有效候选时返回分数最高的候选。
* [ ] 新增单元测试覆盖 builder、detector、scorer、selector 的关键路径。
* [ ] `npm run lint` / `npm run typecheck` / `npm test` 全绿。

## Test URL Set

* 通用公开页：优先使用 `https://example.com/` 与一个稳定文档页，用于验证正常内容抽取。
* 已知阻挡页：`https://vault.991949.xyz/`，用于验证 401 / 403 / CDN 盾 / 反爬验证页排除规则。

## Requirements (evolving)

* `fetch` 工具只支持单个 URL 输入；多 URL 不再作为本工具能力，传多个 URL 时应返回入参错误。
* 对单个 URL 并发调用多个已配置/指定的抓取 provider。
* 真实 provider 测试优先覆盖“通用公开页 + 已知阻挡页”：公开页由项目内选择稳定样例，阻挡页优先使用用户实际遇到的问题 URL。
* 先通过真实 provider 测试搞清楚 Firecrawl、Jina Reader、Tavily Extract、Exa Contents 在成功、失败、阻挡页、空内容场景下分别返回哪些字段。
* 对每个 provider 结果做统一成功判定；成功不只等于 HTTP 2xx / Promise fulfilled。
* 优先排除 401、403、CDN 盾、反爬验证页、登录/权限阻挡页、空内容等无效结果。
* 对每个 URL 从有效结果中选出质量最高的抓取结果；质量评分细节后续根据实测字段再最终确定。
* 默认返回结构为“每个 URL 只返回一个 best result”。
* 正常成功返回中保留 `provider` 字段，说明 best result 来自哪个平台；不暴露内部质量分。
* 不保留 warnings；只有最终无法返回有效结果时才返回 error。
* 当部分 provider 失败但至少一个 provider 有有效结果时，整体视为成功，只返回 best result。

## Acceptance Criteria (evolving)

* [ ] 有一份研究/测试记录说明各 fetch provider 在代表性 URL 上的返回字段、失败字段与阻挡页表现。
* [ ] 成功判定能区分 provider 报错、无结果、空内容、有效内容、401/403/CDN 盾/反爬验证页。
* [ ] `fetch` schema 只接受单个 URL；多 URL 输入返回入参错误。
* [ ] 单 URL 多 provider 成功时，只返回质量最高的结果作为主结果。
* [ ] 部分 provider 失败但存在有效结果时，不返回 warnings/error，只返回 best result。
* [ ] 某 URL 全部 provider 失败或无有效内容时，该 URL 有清晰 error 表示。
* [ ] 单元测试覆盖并发、部分失败、全部失败、空内容、阻挡页排除、质量择优。

## Decision (ADR-lite)

**Context**: 当前 `fetch` 返回 byProvider 视图，调用方需要自行比较各 provider 抓取质量；用户目标是“最后只返回抓取质量最高的那个”。
**Decision**: MVP 将 `fetch` 收敛为单 URL 工具；默认只返回该 URL 的 best result；成功结果包含 `provider` 字段用于说明来源，不暴露内部质量分；不保留 warnings；只有无法得到有效抓取结果时返回 error。
**Consequences**: 接口更简单，同时保留最低限度可解释性；但失去默认调试明细和多 URL 批量能力；测试需要覆盖部分 provider 失败时仍成功、全部失败时才 error。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 本任务不新增新的抓取 provider。
* 本任务不改变搜索 `search` 的 RRF 融合逻辑。
* 除非后续明确选择，否则不引入 LLM 作为抓取质量评估器。

## Technical Notes

* Core aggregator: `src/aggregator/fetch.ts`
* MCP tool wrapper: `src/tools/fetch.ts`
* Fetch protocol types: `src/providers/fetch-types.ts`
* Provider implementations: `src/providers/firecrawl-fetch.ts`, `src/providers/jina-fetch.ts`, `src/providers/tavily-fetch.ts`, `src/providers/exa-fetch.ts`
* Existing tests: `tests/unit/fetch-aggregator.test.ts`, `tests/e2e/fetch-tool.test.ts`
* Current success behavior:
  * Firecrawl: HTTP ok 后返回 `data.data.markdown ?? ''`，未检查 `success` 或空 content。
  * Jina: HTTP ok 后返回 `data.data.content ?? ''`，未检查空 content。
  * Tavily: 无 `results[0]` 会抛 `NO_RESULTS`，但 `raw_content ?? ''` 可能为空。
  * Exa: 无 `text` 会抛错，成功结果为纯文本。
