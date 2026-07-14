/**
 * TourAPI 소개 앞부분을 결과 카드에 적당한 밀도로 맞춘다.
 * 문장 순서를 유지하며 목표 길이까지 최대 3문장을 담고, 지나치게 길면 말줄임한다.
 */
export function overviewExcerpt(
  overview: string,
  minLength = 90,
  maxLength = 160,
  maxSentences = 3,
): string {
  const text = overview.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text]
  let excerpt = ''

  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = excerpt ? `${excerpt} ${sentence}` : sentence
    if (next.length > maxLength) {
      if (excerpt.length >= minLength) break
      return `${next.slice(0, maxLength - 1).trimEnd()}…`
    }
    excerpt = next
    if (excerpt.length >= minLength) break
  }

  return excerpt
}
