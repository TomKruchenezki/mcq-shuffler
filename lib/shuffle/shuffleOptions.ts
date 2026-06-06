export interface ShuffleResult {
  shuffled: string[]
  answerKeyIndex: number
}

export function shuffleArray<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Shuffles options and returns where index 0 (the correct answer) ended up.
export function shuffleOptions(options: string[], rng?: () => number): ShuffleResult {
  if (options.length === 0) return { shuffled: [], answerKeyIndex: -1 }

  const indices = options.map((_, i) => i)
  const shuffledIndices = shuffleArray(indices, rng)
  const shuffled = shuffledIndices.map((i) => options[i])
  const answerKeyIndex = shuffledIndices.indexOf(0)

  return { shuffled, answerKeyIndex }
}
