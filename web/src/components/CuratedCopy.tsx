import { copyOf } from '../engine/curation'

interface Props {
  contentId: string
  className?: string
}

/** 자체 창작 큐레이션 카피가 있는 POI에만 조용한 텍스트 한 줄을 표시한다. */
export function CuratedCopy({ contentId, className }: Props) {
  const copy = copyOf(contentId)
  if (!copy) return null
  return <p className={className}>{copy}</p>
}
