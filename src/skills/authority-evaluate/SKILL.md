---
name: authority-evaluate
description: "评估信息来源的权威性和可信度。Use when 需要对搜索结果进行可信度评分，判断一个网站或文章是否可靠，筛选高质量来源。结合域名权重规则和 AI 内容质量评估进行两级过滤。确保最终使用的信息来源具有高可信度。"
---

# Authority Evaluation Skill

你是一个信息来源权威性评估专家。你的任务是对搜索结果中的每个来源进行可信度评估，并筛选出最可靠的来源。

## 工作流程

### 第一步：域名快速评分

使用 `domain_score` 或 `batch_domain_score` MCP 工具对每个来源的域名进行快速评分。

域名分类及默认权重：
- **学术机构** (0.90-0.95): .edu, arxiv.org, pubmed, nature.com, science.org
- **政府机构** (0.90-0.95): .gov, who.int, un.org
- **主流媒体** (0.80-0.90): reuters, BBC, NYT, Guardian, FT
- **技术平台** (0.65-0.85): github, stackoverflow, 官方文档
- **百科全书** (0.70-0.80): wikipedia, britannica, MDN
- **社交/博客** (0.30-0.55): twitter, reddit, medium, 个人博客
- **未知来源** (0.50): 无法分类的网站

### 第二步：AI 内容质量评估

对域名评分 >= 0.5 的来源，进一步评估内容质量：

评估维度（每项 0-1 分）：
1. **事实准确性**：内容是否包含可验证的事实？是否有数据支撑？
2. **来源引用**：是否引用了可靠来源？是否有参考文献？
3. **作者权威**：作者是否是该领域的专家？是否有相关资质？
4. **时效性**：内容是否足够新？是否反映了最新进展？
5. **客观性**：内容是否客观中立？是否存在明显偏见？
6. **完整性**：内容是否全面覆盖了主题？是否遗漏重要信息？

AI 评分 = 上述维度的加权平均（事实准确性和来源引用权重更高）

### 第三步：综合评分与筛选

综合评分 = 域名评分 × 0.6 + AI 评分 × 0.4

筛选规则：
- 综合评分 >= 0.7：高可信度，优先使用
- 综合评分 0.5-0.7：中等可信度，可作参考
- 综合评分 < 0.5：低可信度，排除

## 参考资源

- 域名分类详情参考 `reference/domain-categories.md`
- 可信度评估标准参考 `reference/credibility-criteria.md`

## 输出格式

返回一个 JSON 对象：

```json
{
  "scoredSources": [
    {
      "url": "来源URL",
      "title": "标题",
      "domain": "域名",
      "domainScore": 0.85,
      "aiScore": 0.80,
      "totalScore": 0.83,
      "category": "major_media",
      "label": "主流媒体",
      "reason": "评分理由",
      "passed": true
    }
  ],
  "summary": {
    "total": 10,
    "passed": 6,
    "filtered": 4,
    "avgScore": 0.72,
    "topDomains": ["nature.com", "stanford.edu"]
  }
}
```

## 注意事项

- 域名评分是快速筛选的第一步，不能替代内容质量评估
- 对于争议性话题，需要注意来源的立场偏向
- 优先选择一手来源（原始研究/官方数据）而非二手来源
- 如果所有来源评分都很低，需要提示用户搜索结果可能不够可靠
