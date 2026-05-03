export type Gender = '男' | '女' | '未知'
export type UserRole = 'user' | 'admin'

export type DbUser = {
  id: string
  uid: string
  nickname: string
  passwordHash: string
  avatarUrl: string
  age: string
  gender: Gender
  role: UserRole
}

export type DbReply = {
  id: string
  userId: string
  userName: string
  avatarUrl: string
  content: string
  createdAt: string
}

export type DbPost = {
  id: string
  type: '' | '主页' | '精品' | '直播' | '我的'
  isFeatured: boolean
  isPinned: boolean
  isLocked: boolean
  tag: string
  title: string
  authorName: string
  avatarUrl: string
  createdAt: string
  replies: DbReply[]
}

export type DbMessage = {
  id: string
  senderId: string
  receiverId: string
  content: string
  createdAt: string
}

export type DbFollow = {
  followerId: string
  followeeId: string
  createdAt: string
}

export type DbBlock = {
  blockerId: string
  blockedId: string
  createdAt: string
}

export type Database = {
  users: DbUser[]
  posts: DbPost[]
  messages: DbMessage[]
  follows: DbFollow[]
  blocks: DbBlock[]
}
