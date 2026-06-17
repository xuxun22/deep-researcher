# 正文提取规则

## HTML 正文识别策略

### 1. 基于内容密度
正文区域通常具有以下特征：
- 连续段落较多（<p> 标签密集）
- 文本/标签比例高（文字多，HTML标签少）
- 链接密度适中（正文中链接不会太多也不会太少）

### 2. 常见正文容器
按优先级：
- `<article>` 标签
- `role="main"` 元素
- `.post-content`, `.article-content`, `.entry-content`
- `#content`, `#main-content`
- `<main>` 标签

### 3. 常见噪音容器（需排除）
- `<nav>`, `<header>` (导航类), `<footer>`
- `.sidebar`, `.widget`, `.ad`, `.advertisement`
- `.comments`, `.comment-section`
- `.social-share`, `.related-posts`
- `.newsletter-signup`, `.popup`

## 内容质量标准

### 高质量 (quality: "high")
- 字数 > 500
- 有明确的段落结构
- 包含具体数据或引用
- 可读性好（无明显 HTML 残留）

### 中等质量 (quality: "medium")
- 字数 200-500
- 基本可读但结构不够清晰
- 内容较简略

### 低质量 (quality: "low")
- 字数 < 200
- 或大量 HTML/脚本残留
- 或内容不连贯

## 语言检测方法

通过以下线索判断内容语言：
1. 字符集特征（中文字符 vs 拉丁字符比例）
2. 常见词汇模式
3. HTML meta 标签中的 lang 属性
4. 内容中的语言标记词
