# src/providers 目录说明

## 目录职责
- 本目录负责实现各个外部渠道的 provider / adapter。
- 主要包含两类实现：
  - `*-search` 相关：把统一的 `ProviderSearchParams` 编译成各渠道请求，并把响应归一化为 `RawProviderResult`。
  - `*-fetch` 相关：把统一抓取请求归一化为 `RawFetchResult`。
- `registry.ts` 负责按配置实例化 provider，并决定哪些渠道出现在 search/fetch 列表中。
- `search-types.ts`、`fetch-types.ts`、`types.ts` 定义本目录统一协议；`search-provider-utils.ts` 放共享编译与归一化逻辑。

## 本目录工作原则
- 修改 provider 时，优先保持“统一入参 -> 渠道编译 -> 统一结果”的结构，不要把聚合层逻辑塞进单个 adapter。
- 能复用 `search-provider-utils.ts` 的编译、过滤、限流、能力说明逻辑时，优先复用，避免在各 provider 中重复实现。
- provider 内只处理该渠道特有的请求映射、响应解析、错误翻译；跨渠道通用规则应放回共享工具或上层聚合逻辑。
- 新增字段时，先确认它属于统一协议层还是渠道私有行为；只有对多个 provider 都成立的能力，才进入 `search-types.ts` / `fetch-types.ts`。
- provider 不负责 search score weighting、domain blacklist filtering 或最终排序重排；这些逻辑属于 aggregator / config 层。
- 如果搜索结果包含空 URL 或 sentinel URL，provider 只需按统一协议返回原始结果，不要自行参与黑名单判断，也不要在 adapter 内推断聚合后的过滤行为。

## 新增渠道实现适配器
当需要新增一个搜索或抓取渠道时，按下面顺序修改：

1. **确认渠道类型**
   - 搜索渠道：实现 `SearchProvider`，通常继承 `CompiledSearchProvider`。
   - 抓取渠道：实现 `FetchProvider`。
   - 若同时支持 search/fetch，分别实现两个 adapter 文件，保持单一职责。

2. **补齐类型声明**
   - 在 `src/config/types.ts` 中扩展 `ProviderId` 与对应配置项。
   - 在 `src/providers/types.ts` 中补齐 `PROVIDER_CAPABILITIES`。
   - 只有确实需要统一暴露的新能力，才修改 `search-types.ts` 或 `fetch-types.ts`。

3. **新增 adapter 文件**
   - 参考现有命名，使用 `<provider>.ts` 或 `<provider>-fetch.ts`。
   - 搜索 adapter 优先复用 `CompiledSearchProvider`，实现：
     - `id`
     - `buildCapabilityNote()`
     - `execute(params)`
   - 抓取 adapter 直接实现 `fetch(url, params)`，返回 `RawFetchResult`。

4. **保持归一化约定**
   - 搜索结果统一返回 `RawProviderResult`：`url`、`title`、可选 `content`、可选 `publishedDate`。
   - 抓取结果统一返回 `RawFetchResult`：`url`、`content`、`format`、`fetchedAt`。
   - 渠道返回空 URL 时，遵循现有目录模式：仅在 `hasContent=false` 场景过滤；不要在 adapter 内自行生成聚合层 identity。

5. **声明渠道能力边界**
   - 在 `buildCapabilityNote()` 中明确：
     - `nativeFields`
     - `rewrittenFields`
     - `ignoredFields`
     - 必要时补充 `notes`
   - 如果字段是“编译后支持”而不是“原生支持”，写进 `rewrittenFields` 或 `notes`，不要误报为 native。

6. **接入注册表**
   - 在 `src/providers/registry.ts` 中：
     - 导入新 adapter
     - 更新 `ALL_PROVIDERS`
     - 在 `isConfigured()` 中加入配置判断
     - 在 `getSearchProviders()` / `getFetchProviders()` 中实例化并注册

7. **补测试**
   - 至少为新 adapter 增加单测，覆盖：
     - 请求参数映射
     - 空 URL 行为
     - `hasContent` 分支
     - 关键字段如 language / region / date / domain filter 的编译行为
   - 优先沿用 `tests/unit/search-adapters.test.ts` 的风格。

## 修改时的注意事项
- `baseUrl` 拼接保持与现有 provider 一致：先去掉结尾 `/`，再补路径，避免双斜杠。
- 远端能力不足时，优先通过 query rewrite 或 adapter-side filtering 兼容，并在 `buildCapabilityNote()` 中说明。
- 不要因为单个渠道的特殊性修改统一协议命名；若只是该渠道特例，把差异留在 adapter 内。
- 若遇到某渠道 API 细节、限额、字段语义不清，先阅读该渠道官方文档，再动实现；本目录只保留规则摘要，不内嵌大段文档。

## 快速定位
- 新增/接入渠道入口：`src/providers/registry.ts`
- 搜索统一协议：`src/providers/search-types.ts`
- 抓取统一协议：`src/providers/fetch-types.ts`
- 共享编译与归一化逻辑：`src/providers/search-provider-utils.ts`
- 能力声明：`src/providers/types.ts`
