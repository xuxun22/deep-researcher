import { describe, it, expect } from 'vitest';
import { extractDomain, rankSources, filterByThreshold, getTopSources } from '@/lib/authority/ranker';

describe('ranker', () => {
  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractDomain('https://stanford.edu/page')).toBe('stanford.edu');
      expect(extractDomain('https://nature.com/articles/123')).toBe('nature.com');
    });

    it('handles invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe('not-a-url');
    });
  });

  describe('rankSources', () => {
    it('ranks academic sources higher than social media', () => {
      const sources = [
        { url: 'https://twitter.com/user/status/123', title: 'Tweet' },
        { url: 'https://stanford.edu/research/paper', title: 'Paper' },
      ];

      const ranked = rankSources(sources);
      expect(ranked[0].domain).toBe('stanford.edu');
      expect(ranked[0].totalScore).toBeGreaterThan(ranked[1].totalScore);
    });

    it('applies AI score when provided', () => {
      const sources = [
        { url: 'https://unknown-site.com/page', title: 'Page', aiScore: 0.9 },
        { url: 'https://unknown-site.com/other', title: 'Other', aiScore: 0.3 },
      ];

      const ranked = rankSources(sources);
      expect(ranked[0].aiScore).toBe(0.9);
      expect(ranked[0].totalScore).toBeGreaterThan(ranked[1].totalScore);
    });

    it('falls back to domain-only score when AI score is null', () => {
      const sources = [
        { url: 'https://nature.com/article', title: 'Article', aiScore: null },
      ];

      const ranked = rankSources(sources);
      expect(ranked[0].totalScore).toBe(ranked[0].domainScore);
    });
  });

  describe('filterByThreshold', () => {
    it('filters out low-scoring sources', () => {
      const sources = rankSources([
        { url: 'https://stanford.edu/research', title: 'Good' },
        { url: 'https://random-spam.xyz', title: 'Bad' },
      ]);

      const filtered = filterByThreshold(sources, 0.6);
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.every(s => s.totalScore >= 0.6)).toBe(true);
    });
  });

  describe('getTopSources', () => {
    it('returns limited number of top sources', () => {
      const sources = rankSources([
        { url: 'https://a.com', title: 'A' },
        { url: 'https://b.com', title: 'B' },
        { url: 'https://c.com', title: 'C' },
      ]);

      const top = getTopSources(sources, 2);
      expect(top.length).toBe(2);
    });
  });
});
