const AUTH_STORAGE_KEY = 'tq_bbs_auth'

const envApi = (): string | undefined => {
  const v = __TQ_BBS_API_BASE__
  return v ? v : undefined
}

const isLocalhostApiUrl = (url: string) => {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** 解析 API 根地址；公网访问时走同域 /api（见 vite.config + `.env.development`） */
function resolveApiBase(): string {
  const env = envApi()

  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h !== 'localhost' && h !== '127.0.0.1') {
      if (env && env !== '' && !isLocalhostApiUrl(env)) return env
      return ''
    }
  }

  if (import.meta.env.DEV) {
    return env !== undefined && env !== '' ? env : ''
  }

  let base = env !== undefined && env !== '' ? env : ''
  if (import.meta.env.PROD && base && isLocalhostApiUrl(base)) base = ''
  return base
}

const FORCE_MOCK_MODE = import.meta.env.VITE_USE_MOCK === 'true'

type ApiOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  auth?: boolean
}

const getToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed.token?.trim() || ''
  } catch {
    return ''
  }
}

export const apiRequest = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  if (FORCE_MOCK_MODE) {
    throw new Error(`Mock mode enabled: skip API request ${path}`)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const base = resolveApiBase()
  const res = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message || '请求失败')
  }

  return data as T
}
