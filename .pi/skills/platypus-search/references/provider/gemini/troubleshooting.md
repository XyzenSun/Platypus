# Gemini Grounding 调用排查

缺少 `PLATYPUS_GEMINI_API_KEY` 时检查 `--env` 或系统环境；若返回 401/403，核对 API key 与模型/工具权限。上游 `429 RESOURCE_EXHAUSTED` 一般先查配额和所选模型限制；`503 UNAVAILABLE` 先确认服务状态，避免密集重试。

实际测试中默认 `gemini-flash-lite-latest` 曾返回 503、429；显式 `--model gemini-2.5-flash-lite` 曾成功。这只是测试观察，不保证模型长期可用。`--model` 必须是非空字符串；Gemini adapter 当前只接受 `--query` 与 `--model`，不要把其他 Gemini SDK 配置当作 CLI 参数。如果需要最新 Grounding 模型支持情况，应查官方文档。
