# 实现结果包装层并添加 minScore/maxRank 过滤

## Goal

在 `search` 工具中新增两个可选参数 `minScore` 与 `maxRank`，用于在聚合排序完成后的结果包装层做二次筛选：`minScore` 表示保留分数大于等于该值的结果，`maxRank` 表示仅保留排名小于等于该值的结果；默认两者为空，不做筛选。

## What I already know

* 当前 `search` 工具输入 schema 定义在 `src/tools/schemas.ts`。
* 当前 `search` 请求对象在 `src/tools/search.ts` 中组装后传给 `aggregateSearch()`。
* 当前聚合后处理封装在 `src/aggregator/strategies/post-process.ts`，已负责 provider weight、domain blacklist、重排 rank。
* `SearchResult` 已包含 `score` 与 `rank` 字段，适合在聚合结果层继续筛选。
* 当前后处理测试已覆盖权重、黑名单、Gemini boost 组合，见 `tests/unit/post-process-scoring.test.ts`。

## Assumptions (temporary)

* `minScore` / `maxRank` 属于统一搜索协议层能力，而不是单个 provider 的私有能力。
* 返回结构不变，仅 `results` 数组内容可能变少。

## Open Questions

* 无。

## Requirements

* 为 `search` 工具新增可选输入参数 `minScore`。
* 为 `search` 工具新增可选输入参数 `maxRank`。
* 默认不传这两个参数时，行为与当前完全一致。
* 当传入 `minScore` 时，仅保留 `score >= minScore` 的结果。
* 当传入 `maxRank` 时，仅保留 `rank <= maxRank` 的结果。
* 筛选逻辑放在聚合结果包装/后处理层，而不是放入单个 provider adapter。
* 筛选基于最终结果执行：先完成现有聚合、加权、黑名单过滤与重排，再按最终 `score` / `rank` 一次性筛选。

## Acceptance Criteria

* [ ] `search` 工具 schema 接受可选 `minScore` / `maxRank`。
* [ ] 请求类型与聚合调用链可传递这两个字段。
* [ ] 最终结果在后处理层按最终 `score` / `rank` 正确筛选。
* [ ] 未传参数时，现有测试行为不变。
* [ ] 增加测试覆盖仅 `minScore`、仅 `maxRank`、两者同时存在的场景。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Technical Approach

* 在 `src/tools/schemas.ts` 为 `search` 输入新增两个可选字段。
* 在 `src/providers/search-types.ts` 与 `src/tools/search.ts` 把字段纳入统一请求结构。
* 在 `src/aggregator/strategies/post-process.ts` 扩展后处理选项，基于最终 `score` / `rank` 做过滤。
* 保持 provider adapter 无感知，遵循现有 aggregator 分层职责。
* 在相关单测中覆盖筛选前后顺序与默认行为。

## Out of Scope (explicit)

* 不调整 provider 原始返回数量与请求编译逻辑。
* 不新增新的排序算法。
* 不修改现有 provider weight / domain blacklist 配置来源。

## Technical Notes

* 可能涉及文件：`src/tools/schemas.ts`、`src/tools/search.ts`、`src/providers/search-types.ts`、`src/aggregator/strategies/post-process.ts`、相关单测。
* `src/providers/CLAUDE.md` 明确说明 provider 不负责最终过滤与排序，适合在 aggregator 层实现。
* 当前 `PostProcessScoringStrategy` 已有统一 `merge()` 包装点，可最小改动扩展筛选能力。
