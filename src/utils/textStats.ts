/**
 * Text statistics calculation utilities — extracted for reuse and testability.
 */

// Syllable counting helper
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = word.match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

export type TextStatsResult = {
  chars: number
  charsNoSpace: number
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  syllableCount: number
  avgSyllables: number
  flesch: number
  fkGrade: number
  uniqueWords: number
  lexicalDiversity: number
  avgWordLength: number
  avgSentenceLength: number
  readingTimeMin: number
  speakingTimeMin: number
  topWords: [string, number][]
  readingLevel: string
}

/**
 * Analyze text and return a comprehensive stats object.
 * Returns null for empty/whitespace-only input.
 */
export function analyzeText(text: string): TextStatsResult | null {
  if (!text.trim()) return null

  const chars = text.length
  const charsNoSpace = text.replace(/\s/g, '').length
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentenceCount = sentences.length
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const paragraphCount = Math.max(paragraphs.length, 1)

  const syllableCount = words.reduce(
    (sum, word) => sum + countSyllables(word.replace(/[^a-zA-Z]/g, '')),
    0,
  )

  // Average syllables per word
  const avgSyllables = wordCount > 0 ? syllableCount / wordCount : 0

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const flesch =
    sentenceCount > 0 && wordCount > 0
      ? Math.max(
          0,
          Math.min(100, 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * avgSyllables),
        )
      : 0

  // Flesch-Kincaid Grade Level
  const fkGrade =
    sentenceCount > 0 && wordCount > 0
      ? 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59
      : 0

  // Unique words
  const uniqueWords = new Set(
    words.map(w => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')),
  ).size
  const lexicalDiversity = wordCount > 0 ? (uniqueWords / wordCount) * 100 : 0

  // Average word length
  const avgWordLength =
    wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0

  // Average sentence length
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0

  // Reading time (average 238 words per minute)
  const readingTimeMin = wordCount / 238

  // Speaking time (average 150 words per minute)
  const speakingTimeMin = wordCount / 150

  // Top words
  const freq: Record<string, number> = {}
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'i', 'me', 'my', 'myself',
    'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'am', 'and', 'but', 'if', 'or', 'because', 'about',
  ])

  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
    if (clean.length > 2 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] || 0) + 1
    }
  })

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Reading level classification
  let readingLevel: string
  if (flesch >= 90) readingLevel = 'Very Easy (5th grade)'
  else if (flesch >= 80) readingLevel = 'Easy (6th grade)'
  else if (flesch >= 70) readingLevel = 'Fairly Easy (7th grade)'
  else if (flesch >= 60) readingLevel = 'Standard (8-9th grade)'
  else if (flesch >= 50) readingLevel = 'Fairly Difficult (10-12th grade)'
  else if (flesch >= 30) readingLevel = 'Difficult (College)'
  else readingLevel = 'Very Difficult (Graduate)'

  return {
    chars,
    charsNoSpace,
    wordCount,
    sentenceCount,
    paragraphCount,
    syllableCount,
    avgSyllables,
    flesch,
    fkGrade,
    uniqueWords,
    lexicalDiversity,
    avgWordLength,
    avgSentenceLength,
    readingTimeMin,
    speakingTimeMin,
    topWords,
    readingLevel,
  }
}

/**
 * Run textStats tests. Returns a report string describing pass/fail for each assertion.
 * Call from console or integrate into a CI script.
 */
export function runTextStatsTests(): void {
  const results: string[] = []
  let passed = 0
  let failed = 0

  function assert(condition: boolean, label: string) {
    if (condition) {
      passed++
      results.push(`  ✓ ${label}`)
    } else {
      failed++
      results.push(`  ✗ ${label}`)
    }
  }

  // Test: empty text returns null
  const emptyResult = analyzeText('')
  assert(emptyResult === null, 'Empty text returns null')

  const wsResult = analyzeText('   ')
  assert(wsResult === null, 'Whitespace-only text returns null')

  // Test: basic word count
  const basic = analyzeText('hello world')
  assert(basic !== null, 'Basic text returns non-null')
  assert(basic!.wordCount === 2, 'Word count is 2')
  assert(basic!.sentenceCount === 0, 'No sentence terminators → sentenceCount 0')
  assert(basic!.paragraphCount === 1, 'Single paragraph')
  assert(basic!.chars === 11, 'Character count includes space')
  assert(basic!.charsNoSpace === 10, 'Character count without spaces')

  // Test: sentences
  const sentences = analyzeText('This is one. This is two! Is this three?')
  assert(sentences!.sentenceCount === 3, 'Sentence count is 3')

  // Test: syllable counting
  assert(countSyllables('hello') === 2, 'hello has 2 syllables')
  assert(countSyllables('world') === 1, 'world has 1 syllable')
  assert(countSyllables('beautiful') === 3, 'beautiful has 3 syllables')

  // Test: multi-paragraph
  const multiPara = analyzeText('Para one.\n\nPara two.\n\nPara three.')
  assert(multiPara!.paragraphCount === 3, 'Multi-paragraph count is 3')

  // Test: top words (stop word filtering)
  const freq = analyzeText(
    'The quick brown fox jumps over the lazy dog. The quick brown fox jumps again.',
  )
  assert(freq!.topWords.length > 0, 'Top words found')
  const topWordNames = freq!.topWords.map(([w]) => w)
  assert(!topWordNames.includes('the'), 'Stop word "the" excluded from top words')
  assert(topWordNames.includes('quick') || topWordNames.includes('brown') || topWordNames.includes('fox'), 'Content words appear in top words')

  // Test: reading level for simple text
  const simple = analyzeText(
    'The cat sat on the mat. It was a good cat. The cat liked the mat.',
  )
  assert(simple!.readingLevel.includes('Easy') || simple!.readingLevel.includes('Very Easy'), 'Simple text marked as Easy')

  // Test: reading time
  const long = analyzeText(Array(238).fill('word').join(' '))
  assert(Math.abs(long!.readingTimeMin - 1.0) < 0.01, '238 words ≈ 1 minute reading time')

  console.log(`\nText Stats Test Results: ${passed} passed, ${failed} failed\n`)
  console.log(results.join('\n'))
  if (failed > 0) {
    throw new Error(`${failed} text stats test(s) failed`)
  }
}
