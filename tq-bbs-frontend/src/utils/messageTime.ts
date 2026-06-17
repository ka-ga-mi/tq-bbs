const FIVE_MINUTES_MS = 5 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** 从 ISO 或消息 id（m-123 / r-123）解析时间 */
export const resolveMessageCreatedAt = (iso?: string, id?: string) => {
  if (iso) {
    const date = new Date(iso)
    if (!Number.isNaN(date.getTime())) return iso
  }
  const match = id?.match(/^[mr]-(\d+)$/)
  if (!match) return iso
  const date = new Date(Number(match[1]))
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString()
}

/** 与帖子顶部一致：2026-04-28 11:30 */
export const formatMessageTime = (iso?: string, id?: string) => {
  const resolved = resolveMessageCreatedAt(iso, id)
  if (!resolved) return ''
  const date = new Date(resolved)
  if (Number.isNaN(date.getTime())) return resolved.slice(0, 16).replace('T', ' ')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 与上一条相隔超过 5 分钟则显示时间；首条始终显示（若能解析出时间） */
export const shouldShowMessageTime = (
  current?: string,
  previous?: string,
  currentId?: string,
  previousId?: string,
) => {
  const curIso = resolveMessageCreatedAt(current, currentId)
  if (!curIso) return false
  const prevIso = resolveMessageCreatedAt(previous, previousId)
  if (!prevIso) return true
  const cur = new Date(curIso).getTime()
  const prev = new Date(prevIso).getTime()
  if (Number.isNaN(cur) || Number.isNaN(prev)) return true
  return cur - prev > FIVE_MINUTES_MS
}
