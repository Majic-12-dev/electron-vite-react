import { describe, it, expect } from 'vitest';
import { analyzeText, countSyllables } from './textStats';

describe('textStats utilities', () => {
  describe('countSyllables', () => {
    it('counts syllables correctly for simple words', () => {
      expect(countSyllables('hello')).toBe(2);
      expect(countSyllables('world')).toBe(1);
      expect(countSyllables('cat')).toBe(1);
    });

    it('handles complex words', () => {
      expect(countSyllables('beautiful')).toBe(3);
      expect(countSyllables('syllable')).toBe(3);
      expect(countSyllables('organization')).toBe(5);
    });
  });

  describe('analyzeText', () => {
    it('returns null for empty or whitespace-only input', () => {
      expect(analyzeText('')).toBeNull();
      expect(analyzeText('   ')).toBeNull();
      expect(analyzeText('\n\t')).toBeNull();
    });

    it('calculates basic stats for simple text', () => {
      const stats = analyzeText('hello world');
      expect(stats).not.toBeNull();
      expect(stats?.wordCount).toBe(2);
      expect(stats?.chars).toBe(11);
      expect(stats?.charsNoSpace).toBe(10);
      expect(stats?.sentenceCount).toBe(0);
      expect(stats?.paragraphCount).toBe(1);
    });

    it('counts sentences correctly', () => {
      const stats = analyzeText('This is one. This is two! Is this three?');
      expect(stats?.sentenceCount).toBe(3);
    });

    it('counts paragraphs correctly', () => {
      const stats = analyzeText('Para one.\n\nPara two.\n\nPara three.');
      expect(stats?.paragraphCount).toBe(3);
    });

    it('calculates lexical diversity', () => {
      // "the cat the dog" -> unique: cat, dog (2). total: 4. diversity: 50%
      const stats = analyzeText('the cat the dog');
      expect(stats?.uniqueWords).toBe(2);
      expect(stats?.lexicalDiversity).toBe(50);
    });

    it('filters stop words from topWords', () => {
      const stats = analyzeText('The quick brown fox jumps over the lazy dog. The quick brown fox jumps again.');
      const topWords = stats?.topWords.map(([w]) => w) || [];
      
      expect(topWords).not.toContain('the');
      expect(topWords).toContain('quick');
      expect(topWords).toContain('brown');
      expect(topWords).toContain('fox');
    });

    it('calculates expected reading time', () => {
      const text = Array(238).fill('word').join(' ');
      const stats = analyzeText(text);
      expect(stats?.readingTimeMin).toBeCloseTo(1.0, 2);
    });

    it('identifies simple text reading level', () => {
      const stats = analyzeText('The cat sat on the mat. It was a good cat. The cat liked the mat.');
      expect(stats?.readingLevel).toMatch(/Easy|Standard/);
    });

    it('handles numeric input strings as words', () => {
      const stats = analyzeText('123 456');
      expect(stats?.wordCount).toBe(2);
    });
  });
});