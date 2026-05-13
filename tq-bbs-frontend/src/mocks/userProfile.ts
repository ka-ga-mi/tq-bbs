import avatarEye from '../assets/images/avatars/眼.png'
import avatarEar from '../assets/images/avatars/耳.png'
import avatarMouth from '../assets/images/avatars/嘴.png'
import avatarNose from '../assets/images/avatars/鼻.png'

export type UserStatItem = {
  label: string
  value: string
}

export type UserProfile = {
  id: string
  uid: string
  nickname: string
  password: string
  signature: string
  avatarUrl: string
  avatarColor: string
  stats: UserStatItem[]
}

export const avatarAssets = {
  eye: avatarEye,
  ear: avatarEar,
  mouth: avatarMouth,
  nose: avatarNose,
}

const safeDecode = (p: string) => {
  try {
    return decodeURIComponent(p)
  } catch {
    return p
  }
}

/** 根据路径/文件名中的「眼耳鼻嘴」映射到打包后的资源 */
const mapChineseToAsset = (text: string): string | null => {
  if (text.includes('眼')) return avatarAssets.eye
  if (text.includes('耳')) return avatarAssets.ear
  if (text.includes('嘴')) return avatarAssets.mouth
  if (text.includes('鼻')) return avatarAssets.nose
  return null
}

/**
 * 后端常存：
 * - `/src/assets/images/avatars/眼.png`（生产无此路径）
 * - `http://localhost:5173/src/...`（浏览器会去访问用户本机，必裂图）
 * 统一映射为打包后的 `/assets/…` 地址。
 */
export function resolveDisplayAvatarUrl(raw: string | undefined | null): string {
  if (!raw?.trim()) return avatarAssets.nose
  const s = raw.trim()

  if (s.startsWith('data:')) return s

  // 完整 URL：禁止直接放行 localhost / 127.0.0.1 / 含 /src 的开发地址
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s)
      const path = u.pathname + (u.search || '')
      const decoded = safeDecode(path)
      const mapped = mapChineseToAsset(decoded)
      if (mapped) return mapped

      const brokenDev =
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.port === '5173' ||
        path.includes('/src/') ||
        path.includes('avatars')
      if (brokenDev) return avatarAssets.nose

      return s
    } catch {
      return avatarAssets.nose
    }
  }

  if (s.startsWith('/assets/')) return s
  if (s.startsWith('assets/')) return `/${s}`

  const decodedFull = safeDecode(s)
  const mappedPath = mapChineseToAsset(decodedFull)
  if (mappedPath) return mappedPath

  if (s.includes('/src/') || decodedFull.includes('avatars')) {
    const m = mapChineseToAsset(decodedFull)
    return m ?? avatarAssets.nose
  }

  return mapChineseToAsset(s) ?? s
}

export const currentUserProfile: UserProfile = {
  id: 'user-001',
  uid: '7207094',
  nickname: '佚名',
  password: '123456',
  signature: '档案记录',
  avatarUrl: avatarNose,
  avatarColor: 'rgba(170,15,15,.35)',
  stats: [
    { label: '年龄', value: '未知' },
    { label: '性别', value: '女' },
    { label: '粉丝', value: '0' },
    { label: '足迹', value: '1' },
    { label: '关注', value: '0' },
    { label: '我的帖子', value: '0' },
  ],
}

export const mockUsers: UserProfile[] = [
  currentUserProfile,
  {
    id: 'user-002',
    uid: '9911042',
    nickname: '九生有幸',
    password: '123456',
    signature: '夜半回帖中',
    avatarUrl: avatarEye,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '24' },
      { label: '性别', value: '男' },
      { label: '粉丝', value: '17' },
      { label: '足迹', value: '96' },
      { label: '关注', value: '13' },
      { label: '我的帖子', value: '41' },
    ],
  },
  {
    id: 'user-003',
    uid: '8803001',
    nickname: '红花女（狄）',
    password: '123456',
    signature: '夜行者',
    avatarUrl: avatarEar,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '26' },
      { label: '性别', value: '女' },
      { label: '粉丝', value: '34' },
      { label: '足迹', value: '152' },
      { label: '关注', value: '19' },
      { label: '我的帖子', value: '58' },
    ],
  },
  {
    id: 'user-004',
    uid: '7702551',
    nickname: '西封主编-风',
    password: '123456',
    signature: '线索整理中',
    avatarUrl: avatarMouth,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '31' },
      { label: '性别', value: '男' },
      { label: '粉丝', value: '67' },
      { label: '足迹', value: '210' },
      { label: '关注', value: '25' },
      { label: '我的帖子', value: '104' },
    ],
  },
]
