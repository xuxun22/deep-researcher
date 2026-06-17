import { describe, it, expect } from 'vitest';
import { getDomainCategory, getDomainScore, getDomainRules } from '@/lib/authority/domain-rules';

describe('domain-rules', () => {
  describe('getDomainCategory', () => {
    it('classifies .edu domains as academic', () => {
      const result = getDomainCategory('stanford.edu');
      expect(result.category).toBe('academic');
      expect(result.baseScore).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies .gov domains as government', () => {
      const result = getDomainCategory('nih.gov');
      expect(result.category).toBe('government');
      expect(result.baseScore).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies nature.com as major_media', () => {
      const result = getDomainCategory('nature.com');
      expect(result.category).toBe('major_media');
      expect(result.baseScore).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies twitter.com as social', () => {
      const result = getDomainCategory('twitter.com');
      expect(result.category).toBe('social');
      expect(result.baseScore).toBeLessThan(0.5);
    });

    it('classifies unknown domains correctly', () => {
      const result = getDomainCategory('random-website-xyz.com');
      expect(result.category).toBe('unknown');
      expect(result.baseScore).toBe(0.50);
    });

    it('classifies wikipedia.org as encyclopedia', () => {
      const result = getDomainCategory('en.wikipedia.org');
      expect(result.category).toBe('encyclopedia');
      expect(result.baseScore).toBe(0.75);
    });
  });

  describe('getDomainScore', () => {
    it('returns high score for academic domains', () => {
      expect(getDomainScore('mit.edu')).toBeGreaterThanOrEqual(0.9);
    });

    it('returns low score for social media', () => {
      expect(getDomainScore('tiktok.com')).toBeLessThan(0.4);
    });
  });

  describe('getDomainRules', () => {
    it('returns a copy of all rules', () => {
      const rules = getDomainRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('pattern');
      expect(rules[0]).toHaveProperty('category');
      expect(rules[0]).toHaveProperty('baseScore');
    });
  });
});
