# 统一输出格式定义

## 通用输出约定

所有 Skill 的最终输出应：
1. 返回合法的 JSON 对象
2. 不使用 markdown 代码块包裹
3. 包含所有必填字段

## Skill 间数据传递格式

### query-understand → 搜索执行
```json
{
  "intent": "string",
  "keywords": [{ "query": "string", "language": "string", "priority": "string", "type": "string" }],
  "searchStrategy": { "depth": "string", "topic": "string" }
}
```

### 搜索执行 → authority-evaluate
```json
{
  "sources": [{ "url": "string", "title": "string", "content": "string", "score": "number" }]
}
```

### authority-evaluate → content-fetch
```json
{
  "scoredSources": [{ "url": "string", "title": "string", "totalScore": "number", "passed": "boolean" }]
}
```

### content-fetch → summarize
```json
{
  "contents": [{ "url": "string", "title": "string", "text": "string", "language": "string" }]
}
```

### summarize → translate
```json
{
  "overview": "string",
  "detailedAnalysis": "string",
  "language": "string"
}
```

### translate → 最终输出
```json
{
  "translated": "string",
  "glossary": [{ "en": "string", "zh": "string" }]
}
```
