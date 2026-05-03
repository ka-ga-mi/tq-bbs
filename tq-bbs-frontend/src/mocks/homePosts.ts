import { avatarAssets } from './userProfile'

export type HomePostItem = {
  id: string
  type: '' | '主页' | '精品' | '直播' | '我的'
  isFeatured?: boolean
  isPinned?: boolean
  tag: string
  title: string
  authorName: string
  avatarUrl: string
}

export const homePosts: HomePostItem[] = [
  { id: 'post-001', type: '精品', tag: '故事', title: '那个我童年的女孩', authorName: '玲铃铃', avatarUrl: avatarAssets.ear },
  { id: 'post-002', type: '直播', tag: '求助', title: '住在我隔壁的一家三口有点奇怪......（直播）', authorName: '匿名观众', avatarUrl: avatarAssets.nose },
  { id: 'post-003', type: '我的', tag: '讨论', title: '你们那边有什么奇怪的神吗？', authorName: '路过的客', avatarUrl: avatarAssets.nose },
  { id: 'post-004', type: '', tag: '探灵', title: '错位的脸', authorName: '探灵小队', avatarUrl: avatarAssets.nose },
]
