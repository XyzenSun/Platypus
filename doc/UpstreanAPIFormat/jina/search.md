# Jina Reader API

基础地址：

```text
https://s.jina.ai/
```

API 用于搜索网页、读取网页内容、上传文件/PDF 并返回结构化内容、Markdown、HTML、文本、截图等格式。

---

## 1. 端点总览

| 方法 | 路径 | 名称 | 说明 |
|---|---|---|---|
| `GET` | `/{q}` | `search` | 通过路径参数直接搜索 |
| `POST` | `/{q}` | `search` | 通过路径参数搜索，可附带 body |
| `GET` | `/search` | `searchIndex` | 通过 query 参数 `q` 搜索 |
| `POST` | `/search` | `searchIndex` | 通过 body/query 搜索 |

---

## 2. 认证

可选 Header：

```http
Authorization: Bearer {YOUR_JINA_TOKEN}
```

| Header | 类型 | 说明 |
|---|---|---|
| `Authorization` | string | Jina Token，格式为 `Bearer xxx` |

---

## 3. 响应格式控制

使用 `Accept` 指定响应格式：

```http
Accept: application/json
```

支持：

| Accept | 说明 |
|---|---|
| `application/json` / `text/json` | 返回 JSON envelope |
| `text/plain` | 返回纯文本 |
| `text/event-stream` | 返回 SSE 流式响应 |

也可以用：

```http
X-Respond-With: markdown
```

或 query 参数：

```text
respondWith=markdown
```

支持的 `respondWith`：

| 值 | 说明 |
|---|---|
| `content` | 默认内容 |
| `markdown` | Markdown |
| `html` | HTML |
| `text` | 纯文本 |
| `pageshot` | 页面快照 |
| `screenshot` | 截图 |
| `frontmatter` | Frontmatter |
| `readerlm-v2` | ReaderLM v2 结果 |
| `vlm` | 视觉语言模型结果 |

默认：

```text
respondWith=content
```

---

## 4. 搜索端点

### 4.1 `GET /{q}`

通过路径参数搜索。

```http
GET https://s.jina.ai/your-search-query
```

路径参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `q` | string | 是 | 搜索关键词 |

示例：

```bash
curl "https://s.jina.ai/what%20is%20jina%20reader"
```

返回 Markdown：

```bash
curl "https://s.jina.ai/what%20is%20jina%20reader" \
  -H "X-Respond-With: markdown"
```

---

### 4.2 `GET /search`

通过 query 参数搜索。

```http
GET https://s.jina.ai/search?q=your-search-query
```

常用 query 参数：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `q` | string | - | 搜索关键词 |
| `type` | string | `web` | 搜索类型：`web`、`images`、`news` |
| `num` | number | - | 返回数量，范围 `0-20` |
| `count` | number | - | 返回数量，范围 `0-20` |
| `page` | number | - | 搜索页码 |
| `engine` | string | - | 搜索引擎：`google`、`bing`、`reader` |
| `provider` | string | - | 搜索提供方：`google`、`bing`、`reader` |
| `gl` | string | - | 国家/地区代码 |
| `hl` | string | - | 语言代码 |
| `location` | string | - | 搜索位置 |
| `fallback` | boolean | - | 是否启用 fallback |
| `nfpr` | boolean | - | 是否关闭自动纠错/相关搜索 |

示例：

```bash
curl "https://s.jina.ai/search?q=jina%20reader&type=web&num=5" \
  -H "Accept: application/json"
```

---

## 5. POST 请求

### 5.1 `POST /{q}`

```http
POST https://s.jina.ai/{q}
```

### 5.2 `POST /search`

```http
POST https://s.jina.ai/search
```

支持的请求体类型：

| Content-Type | 说明 |
|---|---|
| `application/json` | JSON body |
| `multipart/form-data` | 文件上传 |
| `application/x-www-form-urlencoded` | 表单 |

JSON 示例：

```bash
curl -X POST "https://s.jina.ai/search" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "q": "jina reader api",
    "type": "web",
    "num": 5,
    "respondWith": "markdown"
  }'
```

---

## 6. 网页/文件读取参数

这些参数可用于 query、JSON body，或部分对应 Header。

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `url` | string | - | 要读取的网页 URL |
| `html` | string | - | 直接传入 HTML 内容 |
| `pdf` | string / file | - | Base64 PDF 或上传文件 |
| `file` | string / file | - | Base64 文件或上传文件 |
| `page` | number | - | 文件页码，1-indexed；无文件时忽略 |
| `base` | string | `initial` | 相对 URL 基准：`initial`、`final` |
| `timeout` | number | - | 超时时间，秒；范围 `>0 && <=180` |
| `locale` | string | - | 浏览器 locale |
| `referer` | string | - | Referer |
| `userAgent` | string | - | 覆盖 User-Agent |
| `proxyUrl` | string | - | 自定义代理 |
| `proxy` | string | - | 使用官方代理，可指定国家代码 |
| `robotsTxt` | string | - | 遵守目标站点 robots.txt |
| `assertStatusCode` | number | - | 断言目标页面 HTTP 状态码 |
| `tokenBudget` | number | - | token 预算；搜索端点会忽略 |
| `maxTokens` | number | - | 最大返回 token 数，要求 `>=500` |
| `instruction` | string | - | 提取/处理指令 |
| `jsonSchema` | object | - | 结构化输出 schema |
| `customHeader` | object | - | 自定义请求头，仅 body 中支持 |

---

## 7. 内容保留与清洗

| 参数 | Header | 类型/取值 | 默认值 | 说明 |
|---|---|---|---|---|
| `retainImages` | `X-Retain-Images` | `none` / `all` / `alt` / `all_p` / `alt_p` | `all` | 图片保留模式 |
| `retainMedia` | `X-Retain-Media` | `none` / `text` / `link` / `image` / `html` | `link` | 视频、音频、iframe 媒体保留模式 |
| `retainLinks` | `X-Retain-Links` | `none` / `all` / `text` / `gpt-oss` | `all` | 链接保留模式 |
| `withGeneratedAlt` | `X-With-Generated-Alt` | boolean-like | - | 为缺失 alt 的图片生成 alt 文本 |
| `withImagesSummary` | `X-With-Images-Summary` | boolean-like | - | 生成图片摘要区 |
| `withLinksSummary` | `X-With-links-Summary` | boolean-like/string | - | 生成链接摘要区 |
| `removeOverlay` | `X-Remove-Overlay` | boolean-like | - | 移除页面 overlay |
| `detachInvisibles` | `X-Detach-Invisibles` | boolean-like | - | 快照前临时移除 `display:none` 元素 |
| `removeSelector` | `X-Remove-Selector` | string / array | - | 移除指定 CSS selector |
| `targetSelector` | `X-Target-Selector` | string / array | - | 只返回指定 CSS selector 内容 |
| `waitForSelector` | `X-Wait-For-Selector` | string / array | - | 等待指定元素出现 |
| `keepImgDataUrl` | `X-Keep-Img-Data-Url` | boolean-like | - | Markdown 中保留 data URL 图片 |
| `withIframe` | `X-With-Iframe` | boolean-like/string | - | 将 iframe 内容填入主文档 |
| `withShadowDom` | `X-With-Shadow-Dom` | boolean-like | - | 将 shadow DOM 内容填入主文档 |
| `setCookies` | `X-Set-Cookie` | string / array | - | 设置浏览器 cookies |

---

## 8. Preset 预设

参数：

```text
preset=reader
```

或：

```http
X-Preset: reader
```

支持：

| 值 | 说明 |
|---|---|
| `reader` | 面向人类阅读展示优化 |
| `index` | 面向语义索引优化 |
| `research` | 面向学术/研究 Agent 优化 |
| `agent` | 面向日常 AI Agent 优化 |
| `spider` | 面向递归站点爬取优化 |

说明：Preset 只会填充调用方未显式设置的选项。

---

## 9. 页面渲染与等待策略

| 参数 | Header | 取值 | 说明 |
|---|---|---|---|
| `respondTiming` | `X-Respond-Timing` | `html` | 直接返回未渲染 HTML |
| `respondTiming` | `X-Respond-Timing` | `visible-content` | 有可见内容后立即返回 |
| `respondTiming` | `X-Respond-Timing` | `mutation-idle` | DOM mutation 稳定至少 0.2s 后返回 |
| `respondTiming` | `X-Respond-Timing` | `resource-idle` | 影响内容的资源 0.5s 内无新增后返回 |
| `respondTiming` | `X-Respond-Timing` | `media-idle` | 包含媒体资源在内 0.5s 内无新增后返回 |
| `respondTiming` | `X-Respond-Timing` | `network-idle` | 等待完整网络空闲，类似 `networkidle0` |

爬取引擎 Header：

```http
X-Engine: browser
```

支持：

| Header 值 | 说明 |
|---|---|
| `browser` | 浏览器渲染 |
| `direct` | 直接请求 |
| `cf-browser-rendering` | Cloudflare Browser Rendering |

Body 中的 `engine` 也支持：

```text
auto, browser, curl, cf-browser-rendering
```

---

## 10. Markdown 相关参数

| 参数 | Header | 取值 | 说明 |
|---|---|---|---|
| `markdownChunking` | `X-Markdown-Chunking` | `true`, `h1`-`h5`, `structured`, `s1`-`s5` | 启用 Markdown 分块 |
| `markdown.headingStyle` | `X-Md-Heading-Style` | `setext`, `atx` | 标题风格 |
| `markdown.hr` | `X-Md-Hr` | string | 分割线文本 |
| `markdown.bulletListMarker` | `X-Md-Bullet-List-Marker` | `-`, `+`, `*` | 列表标记 |
| `markdown.emDelimiter` | `X-Md-Em-Delimiter` | `_`, `*` | 斜体标记 |
| `markdown.strongDelimiter` | `X-Md-Strong-Delimiter` | `**`, `__` | 加粗标记 |
| `markdown.linkStyle` | `X-Md-Link-Style` | `inlined`, `referenced`, `discarded` | 链接风格 |
| `markdown.linkReferenceStyle` | `X-Md-Link-Reference-Style` | `full`, `collapsed`, `shortcut`, `discarded` | 引用链接风格 |

---

## 11. Google 搜索操作符

这些参数用于约束搜索结果。

| 参数 | 类型 | 说明 |
|---|---|---|
| `site` | string / array | 限定站点，例如 `site=example.com` |
| `filetype` | string / array | 限定文件类型，例如 `filetype=pdf` |
| `ext` | string / array | 限定扩展名，例如 `ext=pdf` |
| `intitle` | string / array | 标题必须包含指定词 |
| `loc` | string / array | 限定语言，ISO 639-1 两位代码 |

示例：

```bash
curl "https://s.jina.ai/search?q=manual&filetype=pdf&site=honda.com"
```

---

## 12. 上传文件/PDF

### Base64 PDF

```bash
curl -X POST "https://s.jina.ai/search" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "extract content",
    "pdf": "BASE64_ENCODED_PDF",
    "page": 1,
    "respondWith": "markdown"
  }'
```

### Multipart 文件

```bash
curl -X POST "https://s.jina.ai/search" \
  -H "Accept: application/json" \
  -F "file=@document.pdf" \
  -F "page=1" \
  -F "respondWith=markdown"
```

页码规则：

| 参数/Header | 说明 |
|---|---|
| `page` | 文件页码，1-indexed |
| `X-Page` | Header 形式的文件页码 |
| 无文件/PDF 时 | `page` 会被忽略 |

---

## 13. 响应结构

当 `Accept: application/json` 时，返回 envelope：

```json
{
  "code": 200,
  "status": 20000,
  "data": [
    {
      "title": "string",
      "description": "string",
      "url": "string",
      "content": "string",
      "chunks": ["string"],
      "publishedTime": "string",
      "html": "string",
      "text": "string",
      "screenshotUrl": "string",
      "pageshotUrl": "string",
      "numPages": 1,
      "links": {},
      "images": {},
      "warning": "string",
      "metadata": {},
      "external": {}
    }
  ],
  "meta": {}
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | HTTP 状态码镜像，默认 `200` |
| `status` | number | Jina 内部状态码，默认 `20000` |
| `data` | array | 结果数组 |
| `meta` | object | 附加元数据 |

`data[]` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `url` | string | 结果 URL，必有 |
| `title` | string | 标题 |
| `description` | string | 描述 |
| `content` | string | 内容 |
| `chunks` | string[] | 分块内容 |
| `publishedTime` | string | 发布时间 |
| `html` | string | HTML 内容 |
| `text` | string | 纯文本内容 |
| `screenshotUrl` | string | 截图 URL |
| `pageshotUrl` | string | 页面快照 URL |
| `numPages` | number | 文件页数 |
| `links` | object / string[] | 链接 |
| `images` | object / string[] | 图片 |
| `warning` | string | 警告信息 |
| `metadata` | object | 元数据 |
| `external` | object | 外部扩展信息 |

---

## 14. 常用示例

### 搜索并返回 JSON

```bash
curl "https://s.jina.ai/search?q=jina%20reader&num=5" \
  -H "Accept: application/json"
```

### 搜索并返回 Markdown

```bash
curl "https://s.jina.ai/search?q=jina%20reader" \
  -H "X-Respond-With: markdown"
```

### 读取指定网页

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com&respondWith=markdown"
```

### 只提取页面主体区域

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com" \
  -H "X-Target-Selector: main" \
  -H "X-Respond-With: markdown"
```

### 移除导航栏再返回

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com" \
  -H "X-Remove-Selector: nav" \
  -H "X-Respond-With: markdown"
```

### 等待动态内容加载

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com" \
  -H "X-Wait-For-Selector: .content-block" \
  -H "X-Respond-Timing: network-idle"
```

### 禁用缓存

```bash
curl "https://s.jina.ai/search?q=jina%20reader" \
  -H "X-No-Cache: true"
```

### 设置超时

```bash
curl "https://s.jina.ai/search?q=jina%20reader" \
  -H "X-Timeout: 60"
```

### 使用代理

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com" \
  -H "X-Proxy: us"
```

### 自定义代理

```bash
curl "https://s.jina.ai/search?url=https%3A%2F%2Fexample.com" \
  -H "X-Proxy-Url: https://user:pass@host:port"
```

---

## 15. 参数校验规则摘要

| 参数 | 规则 |
|---|---|
| `timeout` | `> 0 && <= 180` |
| `maxTokens` | `>= 500` |
| `num` | `>= 0 && <= 20` |
| `count` | `>= 0 && <= 20` |
| `page`，文件读取场景 | 整数且 `>= 1` |
| `gl` | 必须是合法国家/地区代码 |
| `hl` | 必须是合法语言代码 |

---

## 16. 推荐用法

普通搜索：

```http
GET /search?q=关键词&num=5
```

读取网页为 Markdown：

```http
GET /search?url=https://example.com&respondWith=markdown
```

复杂抓取建议使用 Header：

```http
X-Respond-With: markdown
X-Target-Selector: main
X-Respond-Timing: network-idle
X-No-Cache: true
```

需要结构化数据时使用 `POST /search`：

```json
{
  "url": "https://example.com",
  "respondWith": "content",
  "instruction": "Extract product name, price and availability",
  "jsonSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "price": { "type": "string" },
      "availability": { "type": "string" }
    }
  }
}
```