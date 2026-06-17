const FIVE_MINUTES_MS = 5 * 60 * 1000

export const formatMessageTime = (iso?: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ')
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 与上一条相隔超过 5 分钟则显示时间；首条始终显示（若有时间） */
export const shouldShowMessageTime = (current?: string, previous?: string) => {
  if (!current) return false
  if (!previous) return true
  const cur = new Date(current).getTime()
  const prev = new Date(previous).getTime()
  if (Number.isNaN(cur) || Number.isNaN(prev)) return true
  return cur - prev > FIVE_MINUTES_MS
}
