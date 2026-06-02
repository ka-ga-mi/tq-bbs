export type AvatarKey = 'eye' | 'ear' | 'mouth' | 'nose'

const AVATAR_KEYS = new Set<AvatarKey>(['eye', 'ear', 'mouth', 'nose'])

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 从任意历史格式（开发路径、打包 URL、中文文件名）解析为稳定 key */
export const normalizeAvatarUrl = (url: string | undefined | null): AvatarKey | '' => {
  if (!url?.trim()) return ''
  const raw = url.trim()
  if (AVATAR_KEYS.has(raw as AvatarKey)) return raw as AvatarKey

  const decoded = safeDecode(raw)
  const probe = `${raw} ${decoded}`.toLowerCase()

  if (probe.includes('eye') || decoded.includes('眼')) return 'eye'
  if (probe.includes('ear') || decoded.includes('耳')) return 'ear'
  if (probe.includes('mouth') || decoded.includes('嘴') || decoded.includes('口')) return 'mouth'
  if (probe.includes('nose') || decoded.includes('鼻')) return 'nose'

  return ''
}

/** API 下发给前端的头像标识（eye / ear / mouth / nose） */
export const sanitizeAvatarUrlForApi = (url: string | undefined): string => normalizeAvatarUrl(url)
