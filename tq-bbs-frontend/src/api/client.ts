const AUTH_STORAGE_KEY = 'tq_bbs_auth'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
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
  // Allow frontend to keep using local mock data even when backend is running.
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

  const res = await fetch(`${API_BASE_URL}${path}`, {
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
