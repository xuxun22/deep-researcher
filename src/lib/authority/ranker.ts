import { getDomainScore, getDomainCategory } from './domain-rules';

export interface ScoredSource {
  url: string;
  title: string;
  domain: string;
  domainScore: number;
  aiScore: number | null;
  totalScore: number;
  category: string;
  label: string;
  reason: string;
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function rankSources(sources: Array<{
  url: string;
  title: string;
  aiScore?: number | null;
}>): ScoredSource[] {
  const scored = sources.map((source) => {
    const domain = extractDomain(source.url);
    const { category, baseScore, label } = getDomainCategory(domain);
    const domainScore = baseScore;
    const aiScore = source.aiScore ?? null;

    const aiWeight = 0.4;
    const domainWeight = 0.6;
    const totalScore = aiScore !== null
      ? domainScore * domainWeight + aiScore * aiWeight
      : domainScore;

    return {
      url: source.url,
      title: source.title,
      domain,
      domainScore,
      aiScore,
      totalScore,
      category,
      label,
      reason: `域名类型: ${label} (${category}), 域名评分: ${domainScore.toFixed(2)}${aiScore !== null ? `, AI评分: ${aiScore.toFixed(2)}` : ''}`,
    };
  });

  return scored.sort((a, b) => b.totalScore - a.totalScore);
}

export function filterByThreshold(sources: ScoredSource[], threshold: number = 0.5): ScoredSource[] {
  return sources.filter(s => s.totalScore >= threshold);
}

export function getTopSources(sources: ScoredSource[], maxCount: number = 5): ScoredSource[] {
  return sources.slice(0, maxCount);
}

export function computeDomainScore(domain: string): number {
  return getDomainScore(domain);
}
