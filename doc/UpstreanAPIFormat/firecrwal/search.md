> ## Documentation Index
> Fetch the complete documentation index at: https://docs.firecrawl.dev/llms.txt
> Use this file to discover all available pages before exploring further.

# Search（搜索）

`search` 端点将网页搜索与 Firecrawl 的抓取能力相结合，为任意查询返回完整页面内容。

在请求中包含 `scrapeOptions`，并设置 `formats: [{"type": "markdown"}]`，即可为每条搜索结果获取完整的 markdown 内容；否则默认只返回结果（url、title、description）。你也可以使用其他 formats，例如 `{"type": "summary"}` 来获取精简内容。

<div id="supported-query-operators">
  ## 支持的查询运算符
</div>

我们支持多种查询运算符，帮助你更高效地筛选搜索结果。

| 运算符           | 功能                 | 示例                                |
| ------------- | ------------------ | --------------------------------- |
| `""`          | 精确（非模糊）匹配一段文本      | `"Firecrawl"`                     |
| `-`           | 排除特定关键词或对其他运算符取反   | `-bad`, `-site:firecrawl.dev`     |
| `site:`       | 仅返回来自指定网站的结果       | `site:firecrawl.dev`              |
| `filetype:`   | 仅返回具有特定文件扩展名的结果    | `filetype:pdf`, `-filetype:pdf`   |
| `inurl:`      | 仅返回在 URL 中包含某个词的结果 | `inurl:firecrawl`                 |
| `allinurl:`   | 仅返回在 URL 中包含多个词的结果 | `allinurl:git firecrawl`          |
| `intitle:`    | 仅返回在页面标题中包含某个词的结果  | `intitle:Firecrawl`               |
| `allintitle:` | 仅返回在页面标题中包含多个词的结果  | `allintitle:firecrawl playground` |
| `related:`    | 仅返回与特定域相关的结果       | `related:firecrawl.dev`           |
| `imagesize:`  | 仅返回尺寸完全匹配的图片       | `imagesize:1920x1080`             |
| `larger:`     | 仅返回大于指定尺寸的图片       | `larger:1920x1080`                |

<div id="location-parameter">
  ## location 参数
</div>

使用 `location` 参数获取按地理位置定向的搜索结果。格式："string"。示例："Germany"、"San Francisco,California,United States"。

查看[支持的位置完整列表](https://firecrawl.dev/search_locations.json)，了解所有可用的国家和语言。

<div id="country-parameter">
  ## country 参数
</div>

使用 `country` 参数以 ISO 国家/地区代码指定搜索结果所属国家/地区。默认值："US"。

示例："US"、"DE"、"FR"、"JP"、"UK"、"CA"。

```json theme={null}
{
  "query": "餐厅",
  "country": "DE"
}
```

<div id="categories-parameter">
  ## `categories` 参数
</div>

使用 `categories` 参数按特定类别过滤搜索结果：

* **`github`**: 在 GitHub 仓库、代码、问题和文档中搜索
* **`research`**: 搜索学术和研究类网站（arXiv、Nature、IEEE、PubMed 等）
* **`pdf`**: 搜索 PDF

<div id="example-usage">
  ### 使用示例
</div>

```json theme={null}
{
  "query": "机器学习",
  "categories": ["github", "research"],
  "limit": 10
}
```

<div id="domain-filters">
  ## 域名过滤
</div>

使用 `includeDomains` 可将结果限制在特定域名内，或使用 `excludeDomains` 将特定域名从搜索结果中排除。域名只能填写主机名，不包含协议或路径。

`includeDomains` 和 `excludeDomains` 不能同时使用。

<div id="include-domains-example">
  ### 包含域名示例
</div>

```json theme={null}
{
  "query": "web scraping",
  "includeDomains": ["firecrawl.dev", "docs.firecrawl.dev"],
  "limit": 10
}
```

<div id="exclude-domains-example">
  ### 域名排除示例
</div>

```json theme={null}
{
  "query": "web scraping tools",
  "excludeDomains": ["example.com"],
  "limit": 10
}
```

<div id="category-response">
  ### 分类响应
</div>

每个结果都包含一个 `category` 字段，用于表示其来源：

```json theme={null}
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://github.com/example/ml-project",
        "title": "Machine Learning Project",
        "description": "Implementation of ML algorithms",
        "category": "github"
      },
      {
        "url": "https://arxiv.org/abs/2024.12345",
        "title": "ML Research Paper",
        "description": "Latest advances in machine learning",
        "category": "research"
      }
    ]
  }
}
```

<div id="time-based-search">
  ## 基于时间的搜索
</div>

使用 `tbs` 参数按时间范围过滤搜索结果，包括自定义日期区间。详细示例及支持的 formats 请参见 [Search Feature 文档](https://docs.firecrawl.dev/features/search#time-based-search)。

> 你是需要 Firecrawl API 密钥的 AI 代理吗？如需自动化入门说明，请参见 [firecrawl.dev/agent-onboarding/SKILL.md](https://www.firecrawl.dev/agent-onboarding/SKILL.md)。


## OpenAPI

````yaml /zh/api-reference/v2-openapi.json POST /search
openapi: 3.0.0
info:
  contact:
    email: support@firecrawl.dev
    name: Firecrawl Support
    url: https://firecrawl.dev/support
  description: 用于与 Firecrawl 服务交互，执行网页抓取和爬取任务的 API。
  title: Firecrawl API
  version: v2
servers:
  - url: https://api.firecrawl.dev/v2
security:
  - bearerAuth: []
paths:
  /search:
    post:
      tags:
        - Search
      summary: 搜索，并可选择抓取搜索结果
      operationId: searchAndScrape
      requestBody:
        content:
          application/json:
            schema:
              properties:
                categories:
                  description: 根据类别筛选结果。默认值为 []，表示结果不会按类别进行过滤。
                  items:
                    oneOf:
                      - properties:
                          type:
                            enum:
                              - github
                            type: string
                        required:
                          - type
                        title: GitHub
                        type: object
                      - properties:
                          type:
                            enum:
                              - research
                            type: string
                        required:
                          - type
                        title: Research
                        type: object
                      - properties:
                          type:
                            enum:
                              - pdf
                            type: string
                        required:
                          - type
                        title: PDF
                        type: object
                  type: array
                country:
                  default: US
                  description: >-
                    用于按地域定向搜索结果的 ISO 国家代码（例如 `US`）。为获得最佳效果，请同时设置此参数和 `location`
                    参数。
                  type: string
                enterprise:
                  description: >-
                    用于零数据保留（ZDR）的企业搜索选项。端到端 ZDR 使用 `["zdr"]`（10 额度 / 10 个结果），匿名化
                    ZDR 使用 `["anon"]`（2 额度 / 10 个结果）。必须为你的团队启用。
                  items:
                    enum:
                      - anon
                      - zdr
                    type: string
                  type: array
                excludeDomains:
                  description: 排除来自指定域名的搜索结果。域名应仅填写主机名，不包含协议或路径。不能与 includeDomains 一起使用。
                  items:
                    format: hostname
                    type: string
                  type: array
                ignoreInvalidURLs:
                  default: false
                  description: >-
                    从搜索结果中排除对其他 Firecrawl 端点无效的 URL。这样在将搜索结果数据输送到其他 Firecrawl
                    API 端点时，有助于减少错误。
                  type: boolean
                includeDomains:
                  description: 将搜索结果限制在指定域名内。域名应仅填写主机名，不包含协议或路径。不能与 excludeDomains 一起使用。
                  items:
                    format: hostname
                    type: string
                  type: array
                limit:
                  default: 10
                  description: 返回结果的最大数量（使用多个来源时，按每种来源类型分别计算）
                  maximum: 100
                  minimum: 1
                  type: integer
                location:
                  description: >-
                    用于搜索结果的位置参数（例如 `San Francisco,California,United
                    States`）。为获得最佳效果，请同时设置该参数和 `country` 参数。
                  type: string
                query:
                  description: 搜索查询语句
                  maxLength: 500
                  type: string
                scrapeOptions:
                  allOf:
                    - $ref: '#/components/schemas/ScrapeOptions'
                  default: {}
                  description: 抓取搜索结果的选项
                sources:
                  default:
                    - web
                  description: 要搜索的数据源。将决定响应中可用的数组。默认为 ['web']。
                  items:
                    oneOf:
                      - properties:
                          location:
                            description: 用于搜索结果的 location 参数
                            type: string
                          tbs:
                            description: >-
                              用于按时间过滤结果的搜索参数。支持预设时间范围（`qdr:h`、`qdr:d`、`qdr:w`、`qdr:m`、`qdr:y`）、自定义日期范围（`cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY`），以及按日期排序（`sbd:1`）。这些参数值可以组合使用，例如：`sbd:1,qdr:w`。
                            type: string
                          type:
                            enum:
                              - web
                            type: string
                        required:
                          - type
                        title: Web
                        type: object
                      - properties:
                          type:
                            enum:
                              - images
                            type: string
                        required:
                          - type
                        title: Images
                        type: object
                      - properties:
                          type:
                            enum:
                              - news
                            type: string
                        required:
                          - type
                        title: News
                        type: object
                  type: array
                tbs:
                  description: >-
                    用于按时间过滤结果的搜索参数。支持预设时间范围（`qdr:h`、`qdr:d`、`qdr:w`、`qdr:m`、`qdr:y`）、自定义日期范围（`cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY`），以及按日期排序（`sbd:1`）。这些参数值可以组合使用，例如：`sbd:1,qdr:w`。
                  type: string
                timeout:
                  default: 60000
                  description: 超时（毫秒）
                  type: integer
              required:
                - query
              type: object
        required: true
      responses:
        '200':
          content:
            application/json:
              schema:
                properties:
                  creditsUsed:
                    description: 本次搜索消耗的积分数量
                    type: integer
                  data:
                    description: 搜索结果。可用的数组取决于你在请求中指定的源。默认情况下会返回 `web` 数组。
                    properties:
                      images:
                        items:
                          properties:
                            imageHeight:
                              description: 图像高度
                              type: integer
                            imageUrl:
                              description: 图片 URL
                              type: string
                            imageWidth:
                              description: 图片宽度
                              type: integer
                            position:
                              description: 搜索结果的位置
                              type: integer
                            title:
                              description: 搜索结果中的标题
                              type: string
                            url:
                              description: 搜索结果的URL
                              type: string
                          type: object
                        type: array
                      news:
                        items:
                          properties:
                            audio:
                              description: >-
                                如果 `formats` 中包含 `audio`，则返回提取后的 MP3 音频文件的签名
                                URL。该签名 URL 会在 1 小时后过期。
                              nullable: true
                              type: string
                            date:
                              description: 文章日期
                              type: string
                            html:
                              description: 在 formats 中请求时返回的 HTML 内容
                              nullable: true
                              type: string
                            imageUrl:
                              description: 文章图片的 URL
                              type: string
                            links:
                              description: 如果在 formats 中请求，则返回找到的链接
                              items:
                                type: string
                              type: array
                            markdown:
                              description: 在请求抓取时返回的 Markdown 内容
                              nullable: true
                              type: string
                            metadata:
                              properties:
                                description:
                                  type: string
                                error:
                                  nullable: true
                                  type: string
                                sourceURL:
                                  description: 发起请求时使用的原始 URL。如果发生重定向，可能与最终页面的 URL 不一致。
                                  type: string
                                statusCode:
                                  type: integer
                                title:
                                  type: string
                                url:
                                  description: 跟随所有重定向后得到的最终页面 URL。
                                  type: string
                              type: object
                            position:
                              description: 文章位置
                              type: integer
                            rawHtml:
                              description: 在 formats 中请求时返回的原始 HTML 内容
                              nullable: true
                              type: string
                            screenshot:
                              description: >-
                                如果在 formats 中请求截图，将返回其 URL。截图会在 24
                                小时后过期，之后将无法再下载。
                              nullable: true
                              type: string
                            snippet:
                              description: 文章摘录
                              type: string
                            title:
                              description: 文章标题
                              type: string
                            url:
                              description: 文章的 URL 地址
                              type: string
                            video:
                              description: >-
                                如果 `formats` 中包含 `video`，则返回提取后视频文件的签名 URL。该签名
                                URL 会在 1 小时后过期。
                              nullable: true
                              type: string
                          type: object
                        type: array
                      web:
                        items:
                          properties:
                            audio:
                              description: >-
                                如果 `formats` 中包含 `audio`，则返回提取后的 MP3 音频文件的签名
                                URL。该签名 URL 会在 1 小时后过期。
                              nullable: true
                              type: string
                            description:
                              description: 搜索结果中的描述
                              type: string
                            html:
                              description: 在 formats 中请求时返回 HTML 内容
                              nullable: true
                              type: string
                            links:
                              description: 如果在指定的 formats 中请求，将返回找到的链接
                              items:
                                type: string
                              type: array
                            markdown:
                              description: 在请求抓取时返回的 Markdown 内容
                              nullable: true
                              type: string
                            metadata:
                              properties:
                                description:
                                  type: string
                                error:
                                  nullable: true
                                  type: string
                                sourceURL:
                                  description: 发起请求时使用的原始 URL。如果发生重定向，可能与最终页面的 URL 不一致。
                                  type: string
                                statusCode:
                                  type: integer
                                title:
                                  type: string
                                url:
                                  description: 跟随所有重定向后得到的最终页面 URL。
                                  type: string
                              type: object
                            rawHtml:
                              description: 如果在 formats 中请求，则为原始 HTML 内容
                              nullable: true
                              type: string
                            screenshot:
                              description: >-
                                如果在 formats 中请求截图，则会返回截图 URL。截图在 24
                                小时后过期，届时将无法再下载。
                              nullable: true
                              type: string
                            title:
                              description: 搜索结果标题
                              type: string
                            url:
                              description: 搜索结果的URL
                              type: string
                            video:
                              description: >-
                                如果 `formats` 中包含 `video`，则返回提取后视频文件的签名 URL。该签名
                                URL 会在 1 小时后过期。
                              nullable: true
                              type: string
                          type: object
                        type: array
                    type: object
                  id:
                    description: 搜索作业的 ID
                    type: string
                  success:
                    type: boolean
                  warning:
                    description: 在出现任何问题时显示的警告消息
                    nullable: true
                    type: string
                type: object
          description: 成功的响应
        '408':
          content:
            application/json:
              schema:
                properties:
                  error:
                    example: Request timed out
                    type: string
                  success:
                    example: false
                    type: boolean
                type: object
          description: 请求超时
        '500':
          content:
            application/json:
              schema:
                properties:
                  code:
                    example: UNKNOWN_ERROR
                    type: string
                  error:
                    example: An unexpected error occurred on the server.
                    type: string
                  success:
                    example: false
                    type: boolean
                type: object
          description: 服务器错误
      security:
        - bearerAuth: []
components:
  schemas:
    ScrapeOptions:
      properties:
        actions:
          description: 在抓取页面内容之前需要执行的页面 actions
          items:
            oneOf:
              - oneOf:
                  - additionalProperties: false
                    properties:
                      milliseconds:
                        description: 要等待的毫秒数
                        minimum: 1
                        type: integer
                      type:
                        description: 等待指定的毫秒数
                        enum:
                          - wait
                        type: string
                    required:
                      - type
                      - milliseconds
                    title: Wait by Duration
                    type: object
                  - additionalProperties: false
                    properties:
                      selector:
                        description: 用于等待的 CSS 选择器
                        example: '#my-element'
                        type: string
                      type:
                        description: 等待特定元素出现
                        enum:
                          - wait
                        type: string
                    required:
                      - type
                      - selector
                    title: Wait for Element
                    type: object
                title: Wait
              - properties:
                  fullPage:
                    default: false
                    description: 是否捕获整个页面的截图（忽略 viewport.height），还是仅截取当前视口区域。
                    type: boolean
                  quality:
                    description: 截图质量，取值范围为 1 到 100，100 为最高质量。
                    type: integer
                  type:
                    description: 截取屏幕截图。链接将在响应的 `actions.screenshots` 数组中返回。
                    enum:
                      - screenshot
                    type: string
                  viewport:
                    properties:
                      height:
                        description: 视口高度（以像素为单位）
                        type: integer
                      width:
                        description: 以像素为单位的视口宽度
                        type: integer
                    required:
                      - width
                      - height
                    type: object
                required:
                  - type
                title: Screenshot
                type: object
              - properties:
                  all:
                    default: false
                    description: 点击所有匹配该选择器的元素，而不仅仅是第一个。即使没有任何元素匹配该选择器，也不会抛出错误。
                    type: boolean
                  selector:
                    description: 用于查找元素的查询选择器
                    example: '#load-more-button'
                    type: string
                  type:
                    description: 单击一个元素
                    enum:
                      - click
                    type: string
                required:
                  - type
                  - selector
                title: Click
                type: object
              - properties:
                  text:
                    description: 要键入的文本
                    example: Hello, world!
                    type: string
                  type:
                    description: >-
                      向输入框、文本区域或 contenteditable
                      元素写入文本。注意：在写入之前，你必须先使用「click」操作使该元素获得焦点。文本将以逐字符方式输入，以模拟键盘输入。
                    enum:
                      - write
                    type: string
                required:
                  - type
                  - text
                title: Write text
                type: object
              - description: >-
                  请在页面上按下一个按键。按键代码请参见：https://asawicki.info/nosense/doc/devices/keyboard/key_codes.html。
                properties:
                  key:
                    description: 要按的键
                    example: Enter
                    type: string
                  type:
                    description: 在页面上按下任意键
                    enum:
                      - press
                    type: string
                required:
                  - type
                  - key
                title: Press a key
                type: object
              - properties:
                  direction:
                    default: down
                    description: 滚动方向
                    enum:
                      - up
                      - down
                    type: string
                  selector:
                    description: 用于滚动的元素选择器
                    example: '#my-element'
                    type: string
                  type:
                    description: 滚动整个页面或某个特定元素
                    enum:
                      - scroll
                    type: string
                required:
                  - type
                title: Scroll
                type: object
              - properties:
                  type:
                    description: 抓取当前页面内容，并返回其 URL 和 HTML。
                    enum:
                      - scrape
                    type: string
                required:
                  - type
                title: Scrape
                type: object
              - properties:
                  script:
                    description: 待执行的 JavaScript 代码
                    example: document.querySelector('.button').click();
                    type: string
                  type:
                    description: 在页面上执行 JavaScript 代码
                    enum:
                      - executeJavascript
                    type: string
                required:
                  - type
                  - script
                title: Execute JavaScript
                type: object
              - properties:
                  format:
                    default: Letter
                    description: 生成的 PDF 的页面大小
                    enum:
                      - A0
                      - A1
                      - A2
                      - A3
                      - A4
                      - A5
                      - A6
                      - Letter
                      - Legal
                      - Tabloid
                      - Ledger
                    type: string
                  landscape:
                    default: false
                    description: 是否以横向方向生成 PDF
                    type: boolean
                  scale:
                    default: 1
                    description: 生成 PDF 的缩放比例
                    type: number
                  type:
                    description: 生成当前页面的 PDF 文件。该 PDF 文件会通过响应中的 `actions.pdfs` 数组返回。
                    enum:
                      - pdf
                    type: string
                required:
                  - type
                title: Generate PDF
                type: object
          type: array
        blockAds:
          default: true
          description: 启用广告拦截和 Cookie 弹窗拦截功能。
          type: boolean
        excludeTags:
          description: 在输出中需要排除的标签。
          items:
            type: string
          type: array
        formats:
          $ref: '#/components/schemas/Formats'
        headers:
          description: 随请求发送的请求头。可用于传递 cookies、User-Agent 等信息。
          type: object
        includeTags:
          description: 在输出中要包含的标签。
          items:
            type: string
          type: array
        location:
          description: 请求的地理位置设置。指定后，如果有可用的代理，将使用合适的代理，并模拟相应的语言和时区设置。如果未指定，则默认为“US”。
          properties:
            country:
              default: US
              description: ISO 3166-1 alpha-2 国家/地区代码（例如：“US”、“AU”、“DE”、“JP”）
              pattern: ^[A-Z]{2}$
              type: string
            languages:
              description: >-
                按优先级排序的请求首选语言和区域设置。默认为指定位置的语言。详情请参阅：https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language
              items:
                example: en-US
                type: string
              type: array
          type: object
        lockdown:
          default: false
          description: >-
            如果为 true，则仅从 Firecrawl 的缓存中返回该请求的结果，绝不会向目标 URL
            发出外部请求。此选项专为受合规要求限制或隔离网络环境而设计，因为爬取请求本身可能会泄露敏感信息。若缓存未命中，则返回 404 和错误代码
            SCRAPE_LOCKDOWN_CACHE_MISS（未命中时绝不会记录该 URL）。Lockdown 请求按零数据保留处理。默认
            maxAge 会延长至 2 年，因此现有缓存页面仍然仍可使用。命中缓存时计费 5 个额度，缓存未命中时计费 1 个额度。
          type: boolean
        maxAge:
          default: 172800000
          description: >-
            如果页面的缓存版本的生成时间距今少于该毫秒数，则返回该缓存页面；如果缓存版本距今超过该时间，则会重新抓取页面。若你不需要特别新的数据，启用此选项可将抓取速度提升至
            5 倍。默认值为 2 天。
          type: integer
        minAge:
          description: |-
            <[
              {
                "key": "0",
                "translation": "设置后，请求将仅检查缓存，不会触发新的抓取。该值以毫秒为单位，指定缓存数据必须满足的最小存在时长。如果存在匹配的缓存数据，将立即返回。若未找到缓存数据，则返回 404，错误代码为 SCRAPE_NO_CACHED_DATA。将其设为 1 可接受任意缓存数据，不受时长限制。"
              }
            ]</>
          type: integer
        mobile:
          default: false
          description: 若要模拟在移动设备上进行抓取，请将其设置为 true。适用于测试响应式页面并获取移动端截图。
          type: boolean
        onlyCleanContent:
          default: false
          description: >-
            测试版。在已生成的 markdown 上额外执行一轮基于 LLM 的处理，以移除 `onlyMainContent`
            可能遗漏的残余样板内容（如 cookie
            横幅、广告块、社交分享组件、面包屑导航、新闻简报订阅区、评论区、相关文章列表）。标题、列表、表格、代码块、图片引用和内联链接都会保留。可与
            `onlyMainContent` 结合使用（最常见的配置），也可单独使用。当 markdown 超过清理模型的输出 token
            限制时，将跳过此步骤并发出警告（原始 markdown 会保留）。不支持零数据保留请求。
          type: boolean
        onlyMainContent:
          default: true
          description: 仅返回页面主体内容，不包括页眉、导航栏、页脚等。这是在生成 markdown 之前应用的确定性 HTML 层级过滤；不涉及 LLM。
          type: boolean
        parsers:
          default:
            - pdf
          description: >-
            用于控制在抓取过程中如何处理文件。包含 "pdf" 时（默认），会提取 PDF 内容并转换为 Markdown 格式，计费基于页数（每页
            1 点数）。当传入空数组时，会以 base64 编码返回整个 PDF 文件，并对整份 PDF 按单一费率收取 1 点数。
          items:
            oneOf:
              - additionalProperties: false
                properties:
                  maxPages:
                    description: 从该 PDF 中最多解析的页数。必须为不超过 10000 的正整数。
                    maximum: 10000
                    minimum: 1
                    type: integer
                  mode:
                    default: auto
                    description: >-
                      PDF 解析模式。"fast"：仅执行基于文本的提取（提取内嵌文本，速度最快）。"auto"（默认）：优先尝试
                      fast 提取，如有需要再回退到 OCR。"ocr"：对每一页强制执行 OCR 识别。
                    enum:
                      - fast
                      - auto
                      - ocr
                    type: string
                  type:
                    enum:
                      - pdf
                    type: string
                required:
                  - type
                type: object
          type: array
        profile:
          description: >-
            在抓取和交互会话之间启用持久化浏览器存储。抓取时传入一个 profile，以保留 cookies、localStorage
            和会话数据。使用相同 profile 名称的会话会共享浏览器状态。
          properties:
            name:
              description: 配置文件的名称。使用相同名称的抓取任务会共享浏览器状态（cookies、localStorage、会话）。
              maxLength: 128
              minLength: 1
              type: string
            saveChanges:
              default: true
              description: >-
                为 true 时，交互会话停止后，浏览器状态会保存回该 profile。设为 false
                则只加载现有数据而不写入。同一时间只允许一个会话执行保存。
              type: boolean
          required:
            - name
          type: object
        proxy:
          default: auto
          description: |-
            指定要使用的代理类型。

             - **basic**：用于抓取几乎没有或只有基础反爬策略的网站的代理。速度快，通常可用。
             - **enhanced**：用于抓取具有高级反爬策略的网站的增强型代理。速度较慢，但在某些站点上更可靠。每个请求最多消耗 5 点积分。
             - **auto**：当 basic 代理抓取失败时，Firecrawl 会自动重试并切换为 enhanced 代理。如果使用 enhanced 重试成功，该次抓取将收取 5 点积分；如果使用 basic 一次就成功，则只按常规定价计费。
          enum:
            - basic
            - enhanced
            - auto
          type: string
        removeBase64Images:
          default: true
          description: >-
            从 markdown 输出中移除所有 base 64 图像，以避免输出内容过长。这不会影响 html 或 rawHtml
            formats。图像的 alt 文本会保留在输出中，但 URL 会替换为占位符。
          type: boolean
        skipTlsVerification:
          default: true
          description: 在发起请求时跳过 TLS 证书验证。
          type: boolean
        storeInCache:
          default: true
          description: >-
            如果为 true，该页面会存储到 Firecrawl 的索引和缓存中。如果你的抓取操作可能涉及数据保护方面的顾虑，将其设置为 false
            会很有用。使用某些与敏感抓取相关的参数（例如 actions、headers）时，会被强制将此参数设为 false。
          type: boolean
        timeout:
          default: 60000
          description: 请求超时时间（以毫秒为单位）。最小值为 1000（1 秒）。默认值为 60000（60 秒）。最大值为 300000（300 秒）。
          maximum: 300000
          minimum: 1000
          type: integer
        waitFor:
          default: 0
          description: 指定在抓取内容前的延迟时间（毫秒），以便页面有足够时间完成加载。该等待时间是在 Firecrawl 的智能等待功能基础上的额外等待。
          type: integer
      type: object
    Formats:
      default:
        - markdown
      description: >-
        要在响应中包含的输出 formats。你可以指定一个或多个
        formats，既可以使用字符串（例如：`'markdown'`），也可以使用带有其他选项的对象（例如：`{ type: 'json',
        schema: {...} }`）。某些 formats 需要配置特定选项。示例：`['markdown', { type: 'json',
        schema: {...} }]`。
      items:
        oneOf:
          - properties:
              type:
                enum:
                  - markdown
                type: string
            required:
              - type
            title: Markdown
            type: object
          - properties:
              type:
                enum:
                  - summary
                type: string
            required:
              - type
            title: Summary
            type: object
          - properties:
              type:
                enum:
                  - html
                type: string
            required:
              - type
            title: HTML
            type: object
          - properties:
              type:
                enum:
                  - rawHtml
                type: string
            required:
              - type
            title: Raw HTML
            type: object
          - properties:
              type:
                enum:
                  - links
                type: string
            required:
              - type
            title: Links
            type: object
          - properties:
              type:
                enum:
                  - images
                type: string
            required:
              - type
            title: Images
            type: object
          - properties:
              fullPage:
                default: false
                description: 是否捕获整个页面的截图（忽略 viewport.height），还是仅截取当前视口区域。
                type: boolean
              quality:
                description: 截图质量，范围为 1 到 100，100 为最高质量。
                type: integer
              type:
                enum:
                  - screenshot
                type: string
              viewport:
                properties:
                  height:
                    description: 视口高度（像素）
                    type: integer
                  width:
                    description: 视口宽度（像素）
                    type: integer
                required:
                  - width
                  - height
                type: object
            required:
              - type
            title: Screenshot
            type: object
          - properties:
              prompt:
                description: 用于生成 JSON 输出的提示
                type: string
              schema:
                description: >-
                  用于 JSON 输出的 Schema，必须符合 [JSON
                  Schema](https://json-schema.org/) 规范。
                type: object
              type:
                enum:
                  - json
                type: string
            required:
              - type
            title: JSON
            type: object
          - properties:
              modes:
                description: 用于变更跟踪的模式。`git-diff` 提供详细的差异对比，而 `json` 则对比提取出的 JSON 数据。
                items:
                  enum:
                    - git-diff
                    - json
                  type: string
                type: array
              prompt:
                description: 在使用 `json` 模式进行变更跟踪时要使用的提示词。如果未提供，将使用默认提示词。
                type: string
              schema:
                description: >-
                  在使用「json」模式进行 JSON 提取时所用的 schema。用于定义要提取和对比的数据结构。必须符合 [JSON
                  Schema](https://json-schema.org/) 标准。
                type: object
              tag:
                default: null
                description: >-
                  用于变更跟踪的标签。标签可以将变更跟踪历史划分为不同的「分支」，带有特定标签的变更跟踪只会与同一标签下的抓取结果进行比较。如果未提供，则会使用默认标签（null）。
                nullable: true
                type: string
              type:
                enum:
                  - changeTracking
                type: string
            required:
              - type
            title: Change Tracking
            type: object
          - properties:
              type:
                enum:
                  - branding
                type: string
            required:
              - type
            title: Branding
            type: object
          - description: 从受支持的视频 URL（例如 YouTube）中提取音频（MP3）。返回一个签名的 GCS URL。
            properties:
              type:
                enum:
                  - audio
                type: string
            required:
              - type
            title: Audio
            type: object
          - description: 从受支持的视频 URL（如 YouTube）中提取画质最佳的视频。返回一个已签名的 GCS URL。
            properties:
              type:
                enum:
                  - video
                type: string
            required:
              - type
            title: Video
            type: object
          - description: 针对页面提出一个自然语言问题。答案会在响应的 `answer` 字段中返回。
            properties:
              question:
                description: 要针对页面回答的问题。最多 10,000 个字符。
                maxLength: 10000
                type: string
              type:
                enum:
                  - question
                type: string
            required:
              - type
              - question
            title: Question
            type: object
          - description: 从页面中查找相关源文本。所选文本会在响应的 `highlights` 字段中返回。
            properties:
              query:
                description: 针对页面运行的文本选择 query。最多 10,000 个字符。
                maxLength: 10000
                type: string
              type:
                enum:
                  - highlights
                type: string
            required:
              - type
              - query
            title: Highlights
            type: object
      type: array
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````