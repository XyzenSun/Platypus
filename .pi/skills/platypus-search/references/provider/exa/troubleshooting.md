# Exa 调用排查

如果 stderr 显示缺少 `PLATYPUS_EXA_API_KEY`，检查 `platypus [--env <文件>] list` 是否包含 `exa`；CLI 不自动加载当前目录 `.env`。不要打印密钥。

如果出现 `上游 HTTP 401` 或 `403`，核对 Exa key、账号权限以及可选 `PLATYPUS_EXA_BASE_URL` 是否指向 Exa API 根地址；其他非 200 状态看 stderr 中的上游原文，不启动 AI，也不生成 AI 诊断文件。`429` 时先查额度和速率限制，不盲目多次重试。参数错误先用 `platypus search exa --help` 与官方 `/search` 文档核对字段大小写和数组/对象 JSON 语法。
