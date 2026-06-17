export type DomainCategory = 'academic' | 'government' | 'major_media' | 'tech' | 'encyclopedia' | 'social' | 'unknown';

export interface DomainRule {
  pattern: string;
  category: DomainCategory;
  baseScore: number;
  label: string;
}

const DOMAIN_RULES: DomainRule[] = [
  { pattern: '.edu', category: 'academic', baseScore: 0.95, label: '学术机构' },
  { pattern: '.ac.', category: 'academic', baseScore: 0.95, label: '学术机构' },
  { pattern: '.edu.', category: 'academic', baseScore: 0.95, label: '学术机构' },
  { pattern: 'arxiv.org', category: 'academic', baseScore: 0.90, label: '论文预印本' },
  { pattern: 'pubmed.ncbi.nlm.nih.gov', category: 'academic', baseScore: 0.95, label: '医学数据库' },
  { pattern: 'scholar.google', category: 'academic', baseScore: 0.85, label: '学术搜索' },
  { pattern: 'semanticscholar.org', category: 'academic', baseScore: 0.85, label: '学术搜索' },

  { pattern: '.gov', category: 'government', baseScore: 0.95, label: '政府机构' },
  { pattern: '.gov.', category: 'government', baseScore: 0.95, label: '政府机构' },
  { pattern: 'who.int', category: 'government', baseScore: 0.95, label: '世界卫生组织' },
  { pattern: 'un.org', category: 'government', baseScore: 0.90, label: '联合国' },

  { pattern: 'nature.com', category: 'major_media', baseScore: 0.95, label: '顶级期刊' },
  { pattern: 'science.org', category: 'major_media', baseScore: 0.95, label: '顶级期刊' },
  { pattern: 'thelancet.com', category: 'major_media', baseScore: 0.95, label: '顶级期刊' },
  { pattern: 'reuters.com', category: 'major_media', baseScore: 0.85, label: '主流通讯社' },
  { pattern: 'apnews.com', category: 'major_media', baseScore: 0.85, label: '主流通讯社' },
  { pattern: 'bbc.com', category: 'major_media', baseScore: 0.85, label: '主流媒体' },
  { pattern: 'bbc.co.uk', category: 'major_media', baseScore: 0.85, label: '主流媒体' },
  { pattern: 'nytimes.com', category: 'major_media', baseScore: 0.85, label: '主流媒体' },
  { pattern: 'washingtonpost.com', category: 'major_media', baseScore: 0.85, label: '主流媒体' },
  { pattern: 'theguardian.com', category: 'major_media', baseScore: 0.85, label: '主流媒体' },
  { pattern: 'ft.com', category: 'major_media', baseScore: 0.85, label: '财经媒体' },
  { pattern: 'bloomberg.com', category: 'major_media', baseScore: 0.85, label: '财经媒体' },
  { pattern: 'economist.com', category: 'major_media', baseScore: 0.85, label: '主流媒体' },

  { pattern: 'github.com', category: 'tech', baseScore: 0.80, label: '代码托管' },
  { pattern: 'stackoverflow.com', category: 'tech', baseScore: 0.75, label: '技术社区' },
  { pattern: 'docs.', category: 'tech', baseScore: 0.80, label: '官方文档' },
  { pattern: 'developer.', category: 'tech', baseScore: 0.80, label: '开发者平台' },
  { pattern: 'dev.to', category: 'tech', baseScore: 0.65, label: '技术博客' },
  { pattern: 'medium.com', category: 'tech', baseScore: 0.55, label: '博客平台' },
  { pattern: 'substack.com', category: 'tech', baseScore: 0.55, label: '独立订阅' },

  { pattern: 'wikipedia.org', category: 'encyclopedia', baseScore: 0.75, label: '百科全书' },
  { pattern: 'britannica.com', category: 'encyclopedia', baseScore: 0.80, label: '百科全书' },
  { pattern: 'mdn.mozilla', category: 'encyclopedia', baseScore: 0.90, label: '技术百科' },

  { pattern: 'twitter.com', category: 'social', baseScore: 0.35, label: '社交媒体' },
  { pattern: 'x.com', category: 'social', baseScore: 0.35, label: '社交媒体' },
  { pattern: 'reddit.com', category: 'social', baseScore: 0.45, label: '论坛社区' },
  { pattern: 'quora.com', category: 'social', baseScore: 0.40, label: '问答社区' },
  { pattern: 'youtube.com', category: 'social', baseScore: 0.45, label: '视频平台' },
  { pattern: 'tiktok.com', category: 'social', baseScore: 0.30, label: '短视频平台' },
  { pattern: 'facebook.com', category: 'social', baseScore: 0.35, label: '社交媒体' },
  { pattern: 'instagram.com', category: 'social', baseScore: 0.30, label: '社交媒体' },
  { pattern: 'weibo.com', category: 'social', baseScore: 0.35, label: '社交媒体' },
  { pattern: 'zhihu.com', category: 'social', baseScore: 0.50, label: '问答社区' },
];

export function getDomainCategory(domain: string): { category: DomainCategory; baseScore: number; label: string } {
  const lowerDomain = domain.toLowerCase();

  for (const rule of DOMAIN_RULES) {
    if (lowerDomain === rule.pattern || lowerDomain.endsWith(rule.pattern) || lowerDomain.includes(rule.pattern)) {
      return { category: rule.category, baseScore: rule.baseScore, label: rule.label };
    }
  }

  return { category: 'unknown', baseScore: 0.50, label: '未知来源' };
}

export function getDomainScore(domain: string): number {
  return getDomainCategory(domain).baseScore;
}

export function getDomainRules(): DomainRule[] {
  return [...DOMAIN_RULES];
}
