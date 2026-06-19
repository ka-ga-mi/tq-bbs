import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { readDb, writeDb } from './db.js'
import { routeReqParam } from './routeParam.js'
import { signToken, verifyToken } from './auth.js'
import { normalizeAvatarUrl, sanitizeAvatarUrlForApi } from './avatar.js'
import type { DbMessage, DbPost, DbReply, DbUser, Gender } from './types.js'
import { buildNotificationSummary } from './notifications.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const jwtSecret = process.env.JWT_SECRET || 'tq_bbs_dev_secret'
const defaultCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean)
  : defaultCorsOrigins

app.use(cors({ origin: corsOrigins }))
app.use(express.json())

type AuthedRequest = express.Request & { userId?: string }

const authMiddleware: express.RequestHandler = (req: AuthedRequest, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ message: '未登录或 token 缺失' })
    return
  }
  try {
    const payload = verifyToken(token, jwtSecret)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ message: 'token 无效或已过期' })
  }
}

const toPublicUser = (user: DbUser) => ({
  id: user.id,
  uid: user.uid,
  nickname: user.nickname,
  avatarUrl: sanitizeAvatarUrlForApi(user.avatarUrl),
  age: user.age,
  gender: user.gender,
  role: user.role,
})

const requireAdmin = (db: ReturnType<typeof readDb>, userId: string) => {
  const user = db.users.find((item) => item.id === userId)
  return user?.role === 'admin'
}

const isBlockedBetween = (db: ReturnType<typeof readDb>, aUserId: string, bUserId: string) =>
  db.blocks.some(
    (item) =>
      (item.blockerId === aUserId && item.blockedId === bUserId) ||
      (item.blockerId === bUserId && item.blockedId === aUserId),
  )

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const { nickname, password, age, gender, avatarUrl } = req.body as {
    nickname?: string
    password?: string
    age?: string
    gender?: Gender
    avatarUrl?: string
  }

  if (!nickname?.trim() || !password || !age?.trim() || !gender) {
    res.status(400).json({ message: '注册信息不完整' })
    return
  }

  const db = readDb()
  if (db.users.some((item) => item.nickname === nickname.trim())) {
    res.status(409).json({ message: '用户名已存在' })
    return
  }

  let uid = String(1000000 + Math.floor(Math.random() * 8999999))
  while (db.users.some((item) => item.uid === uid)) {
    uid = String(1000000 + Math.floor(Math.random() * 8999999))
  }

  const user: DbUser = {
    id: uuidv4(),
    uid,
    nickname: nickname.trim(),
    passwordHash: await bcrypt.hash(password, 10),
    avatarUrl: normalizeAvatarUrl(avatarUrl) || 'nose',
    age: age.trim(),
    gender,
    role: db.users.length === 0 ? 'admin' : 'user',
  }
  db.users.push(user)
  writeDb(db)

  res.status(201).json({ uid: user.uid, user: toPublicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const { account, password } = req.body as { account?: string; password?: string }
  if (!account?.trim() || !password) {
    res.status(400).json({ message: '请输入账号和密码' })
    return
  }

  const db = readDb()
  const user = db.users.find((item) => item.uid === account.trim() || item.nickname === account.trim())
  if (!user) {
    res.status(401).json({ message: '账号或密码错误' })
    return
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    res.status(401).json({ message: '账号或密码错误' })
    return
  }

  const token = signToken(user.id, jwtSecret)
  res.json({ token, uid: user.uid, user: toPublicUser(user) })
})

app.get('/api/auth/me', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const user = db.users.find((item) => item.id === req.userId)
  if (!user) {
    res.status(404).json({ message: '用户不存在' })
    return
  }
  const postCount = db.posts.filter((post) => post.replies[0]?.userId === user.id).length
  const fansCount = db.follows.filter((item) => item.followeeId === user.id).length
  const followingCount = db.follows.filter((item) => item.followerId === user.id).length
  res.json({ uid: user.uid, user: toPublicUser(user), postCount, fansCount, followingCount })
})

app.get('/api/users/following', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  const followingIds = new Set(db.follows.filter((item) => item.followerId === myId).map((item) => item.followeeId))
  const list = db.users
    .filter((user) => followingIds.has(user.id))
    .map((user) => ({
      id: user.id,
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: sanitizeAvatarUrlForApi(user.avatarUrl),
    }))
  res.json(list)
})

app.get('/api/users/followers', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  const followerIds = new Set(db.follows.filter((item) => item.followeeId === myId).map((item) => item.followerId))
  const list = db.users
    .filter((user) => followerIds.has(user.id))
    .map((user) => ({
      id: user.id,
      uid: user.uid,
      nickname: user.nickname,
      avatarUrl: sanitizeAvatarUrlForApi(user.avatarUrl),
    }))
  res.json(list)
})

app.get('/api/users/:id/public', (req, res) => {
  const db = readDb()
  const targetUser = db.users.find((item) => item.id === routeReqParam(req, 'id'))
  if (!targetUser) {
    res.status(404).json({ message: '用户不存在或已注销' })
    return
  }

  const authoredPosts = db.posts.filter((post) => post.replies[0]?.userId === targetUser.id)
  const fanUserIds = new Set(db.follows.filter((item) => item.followeeId === targetUser.id).map((item) => item.followerId))

  res.json({
    id: targetUser.id,
    uid: targetUser.uid,
    nickname: targetUser.nickname,
    avatarUrl: sanitizeAvatarUrlForApi(targetUser.avatarUrl),
    age: targetUser.age,
    gender: targetUser.gender,
    role: targetUser.role,
    fansCount: fanUserIds.size,
    postCount: authoredPosts.length,
  })
})

app.get('/api/users/:id/follow-status', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const followeeId = routeReqParam(req, 'id')
  const followerId = req.userId as string
  const followeeExists = db.users.some((item) => item.id === followeeId)
  if (!followeeExists) {
    res.status(404).json({ message: '用户不存在或已注销' })
    return
  }
  const followed = db.follows.some((item) => item.followerId === followerId && item.followeeId === followeeId)
  res.json({ followed })
})

app.get('/api/users/:id/block-status', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const blockedId = routeReqParam(req, 'id')
  const blockerId = req.userId as string
  const blockedExists = db.users.some((item) => item.id === blockedId)
  if (!blockedExists) {
    res.status(404).json({ message: '用户不存在或已注销' })
    return
  }
  const blocked = db.blocks.some((item) => item.blockerId === blockerId && item.blockedId === blockedId)
  res.json({ blocked })
})

app.post('/api/users/:id/follow', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const followeeId = routeReqParam(req, 'id')
  const followerId = req.userId as string
  if (!followeeId) {
    res.status(400).json({ message: '缺少用户 id' })
    return
  }
  if (followeeId === followerId) {
    res.status(400).json({ message: '不能关注自己' })
    return
  }
  const followeeExists = db.users.some((item) => item.id === followeeId)
  if (!followeeExists) {
    res.status(404).json({ message: '用户不存在或已注销' })
    return
  }
  if (!db.follows.some((item) => item.followerId === followerId && item.followeeId === followeeId)) {
    db.follows.push({ followerId, followeeId, createdAt: new Date().toISOString() })
    writeDb(db)
  }
  res.json({ ok: true })
})

app.delete('/api/users/:id/follow', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const followeeId = routeReqParam(req, 'id')
  const followerId = req.userId as string
  const before = db.follows.length
  db.follows = db.follows.filter((item) => !(item.followerId === followerId && item.followeeId === followeeId))
  if (db.follows.length !== before) writeDb(db)
  res.json({ ok: true })
})

app.post('/api/users/:id/block', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const blockedId = routeReqParam(req, 'id')
  const blockerId = req.userId as string
  if (!blockedId) {
    res.status(400).json({ message: '缺少用户 id' })
    return
  }
  if (blockedId === blockerId) {
    res.status(400).json({ message: '不能拉黑自己' })
    return
  }
  const blockedExists = db.users.some((item) => item.id === blockedId)
  if (!blockedExists) {
    res.status(404).json({ message: '用户不存在或已注销' })
    return
  }
  let changed = false
  if (!db.blocks.some((item) => item.blockerId === blockerId && item.blockedId === blockedId)) {
    db.blocks.push({ blockerId, blockedId, createdAt: new Date().toISOString() })
    changed = true
  }

  // Blocking severs follow relationships in both directions.
  const followBefore = db.follows.length
  db.follows = db.follows.filter(
    (item) =>
      !(
        (item.followerId === blockerId && item.followeeId === blockedId) ||
        (item.followerId === blockedId && item.followeeId === blockerId)
      ),
  )
  if (db.follows.length !== followBefore) changed = true

  if (changed) writeDb(db)
  res.json({ ok: true })
})

app.delete('/api/users/:id/block', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const blockedId = routeReqParam(req, 'id')
  const blockerId = req.userId as string
  const before = db.blocks.length
  db.blocks = db.blocks.filter((item) => !(item.blockerId === blockerId && item.blockedId === blockedId))
  if (db.blocks.length !== before) writeDb(db)
  res.json({ ok: true })
})

app.delete('/api/auth/account', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const userId = req.userId as string
  const userIndex = db.users.findIndex((item) => item.id === userId)
  if (userIndex === -1) {
    res.status(404).json({ message: '用户不存在' })
    return
  }

  db.users.splice(userIndex, 1)

  db.posts.forEach((post) => {
    if (post.replies.some((reply) => reply.userId === userId)) {
      post.replies = post.replies.map((reply) =>
        reply.userId === userId
          ? {
              ...reply,
              userName: '该用户已注销',
              avatarUrl: '',
            }
          : reply,
      )
    }
    if (post.authorName && post.replies.length > 0 && post.replies[0].userId === userId) {
      post.authorName = '该用户已注销'
      post.avatarUrl = ''
    }
  })

  db.messages = db.messages.filter((message) => message.senderId !== userId && message.receiverId !== userId)
  db.follows = db.follows.filter((follow) => follow.followerId !== userId && follow.followeeId !== userId)
  db.blocks = db.blocks.filter((item) => item.blockerId !== userId && item.blockedId !== userId)
  writeDb(db)
  res.json({ ok: true })
})

app.get('/api/notifications/summary', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const summary = buildNotificationSummary(db, req.userId as string)
  if (!summary) {
    res.status(404).json({ message: '用户不存在' })
    return
  }
  res.json(summary)
})

app.get('/api/posts', (_req, res) => {
  const db = readDb()
  const posts = db.posts.map((item) => ({
    id: item.id,
    type: item.isFeatured ? '精品' : item.type,
    isFeatured: Boolean(item.isFeatured),
    isPinned: Boolean(item.isPinned),
    isLocked: Boolean(item.isLocked),
    tag: item.tag,
    title: item.title,
    authorName: item.authorName || '匿名用户',
    avatarUrl: sanitizeAvatarUrlForApi(item.avatarUrl),
    createdAt: item.createdAt,
  }))
  res.json(posts)
})

app.get('/api/posts/:id', (req, res) => {
  const db = readDb()
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  res.json({
    ...post,
    avatarUrl: sanitizeAvatarUrlForApi(post.avatarUrl),
    replies: post.replies.map((r) => ({
      ...r,
      avatarUrl: sanitizeAvatarUrlForApi(r.avatarUrl),
    })),
  })
})

app.get('/api/posts-mine', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  const myPosts = db.posts.filter((post) => post.replies[0]?.userId === myId)
  res.json(
    myPosts.map((p) => ({
      ...p,
      avatarUrl: sanitizeAvatarUrlForApi(p.avatarUrl),
      replies: p.replies.map((r) => ({
        ...r,
        avatarUrl: sanitizeAvatarUrlForApi(r.avatarUrl),
      })),
    })),
  )
})

app.delete('/api/posts/:id', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  const postId = routeReqParam(req, 'id')

  const postIndex = db.posts.findIndex((p) => p.id === postId)
  if (postIndex === -1) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }

  const post = db.posts[postIndex]
  const authorId = post.replies[0]?.userId
  const isAdmin = requireAdmin(db, myId)
  if (!isAdmin && (!authorId || authorId !== myId)) {
    res.status(403).json({ message: '只能删除你自己发布的帖子' })
    return
  }

  db.posts.splice(postIndex, 1)
  writeDb(db)
  res.json({ ok: true })
})

app.post('/api/posts/:id/featured', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作精品帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isFeatured = true
  writeDb(db)
  res.json({ ok: true })
})

app.delete('/api/posts/:id/featured', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作精品帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isFeatured = false
  writeDb(db)
  res.json({ ok: true })
})

app.post('/api/posts/:id/pinned', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作置顶帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isPinned = true
  writeDb(db)
  res.json({ ok: true })
})

app.delete('/api/posts/:id/pinned', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作置顶帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isPinned = false
  writeDb(db)
  res.json({ ok: true })
})

app.post('/api/posts/:id/locked', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作锁帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isLocked = true
  writeDb(db)
  res.json({ ok: true })
})

app.delete('/api/posts/:id/locked', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const myId = req.userId as string
  if (!requireAdmin(db, myId)) {
    res.status(403).json({ message: '仅管理员可操作锁帖' })
    return
  }
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  post.isLocked = false
  writeDb(db)
  res.json({ ok: true })
})

app.post('/api/posts', authMiddleware, (req: AuthedRequest, res) => {
  const { title, content, tag, isLive } = req.body as {
    title?: string
    content?: string
    tag?: string
    isLive?: boolean
  }
  if (!title?.trim() || !content?.trim()) {
    res.status(400).json({ message: '帖子标题和内容不能为空' })
    return
  }
  const normalizedTag = (tag || '').trim()
  if (!isLive && (!normalizedTag || normalizedTag.length !== 2)) {
    res.status(400).json({ message: '非直播贴标签必须为2个字' })
    return
  }

  const db = readDb()
  const user = db.users.find((item) => item.id === req.userId)
  if (!user) {
    res.status(401).json({ message: '用户不存在，请重新登录' })
    return
  }

  const firstReply: DbReply = {
    id: `r-${Date.now()}`,
    userId: user.id,
    userName: user.nickname,
    avatarUrl: user.avatarUrl,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }

  const newPost: DbPost = {
    id: `post-${Date.now()}`,
    type: isLive ? '直播' : '我的',
    isFeatured: false,
    isPinned: false,
    isLocked: false,
    tag: isLive ? normalizedTag || '直播' : normalizedTag,
    title: title.trim(),
    authorName: user.nickname,
    avatarUrl: user.avatarUrl,
    createdAt: new Date().toISOString(),
    replies: [firstReply],
  }
  db.posts.unshift(newPost)
  writeDb(db)
  res.status(201).json({
    ...newPost,
    avatarUrl: sanitizeAvatarUrlForApi(newPost.avatarUrl),
    replies: newPost.replies.map((r) => ({
      ...r,
      avatarUrl: sanitizeAvatarUrlForApi(r.avatarUrl),
    })),
  })
})

app.post('/api/posts/:id/replies', authMiddleware, (req: AuthedRequest, res) => {
  const { content } = req.body as { content?: string }
  if (!content?.trim()) {
    res.status(400).json({ message: '回复内容不能为空' })
    return
  }

  const db = readDb()
  const user = db.users.find((item) => item.id === req.userId)
  const post = db.posts.find((item) => item.id === routeReqParam(req, 'id'))
  if (!user) {
    res.status(401).json({ message: '用户不存在，请重新登录' })
    return
  }
  if (!post) {
    res.status(404).json({ message: '帖子不存在' })
    return
  }
  if (post.isLocked) {
    res.status(403).json({ message: '该帖子已被管理员锁定，暂时无法回帖' })
    return
  }

  const reply: DbReply = {
    id: `r-${Date.now()}`,
    userId: user.id,
    userName: user.nickname,
    avatarUrl: user.avatarUrl,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  post.replies.push(reply)
  writeDb(db)
  res.status(201).json({
    ...reply,
    avatarUrl: sanitizeAvatarUrlForApi(reply.avatarUrl),
  })
})

app.get('/api/chat/messages/:targetUserId', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const mine = req.userId as string
  const target = routeReqParam(req, 'targetUserId')
  if (!target) {
    res.status(400).json({ message: '缺少目标用户' })
    return
  }
  const messages = db.messages
    .filter(
      (msg) =>
        (msg.senderId === mine && msg.receiverId === target) || (msg.senderId === target && msg.receiverId === mine),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  res.json(messages)
})

app.get('/api/chat/conversations', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const mine = req.userId as string
  const related = db.messages
    .filter((msg) => msg.senderId === mine || msg.receiverId === mine)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const byTarget = new Map<
    string,
    {
      contactId: string
      contactName: string
      avatarUrl: string
      messages: Array<{
        id: string
        senderId: string
        receiverId: string
        content: string
        createdAt: string
      }>
    }
  >()

  related.forEach((msg) => {
    const targetId = msg.senderId === mine ? msg.receiverId : msg.senderId
    const targetUser = db.users.find((item) => item.id === targetId)
    if (!targetUser) return
    if (!byTarget.has(targetId)) {
      byTarget.set(targetId, {
        contactId: targetUser.id,
        contactName: targetUser.nickname,
        avatarUrl: sanitizeAvatarUrlForApi(targetUser.avatarUrl),
        messages: [],
      })
    }
    byTarget.get(targetId)?.messages.push(msg)
  })

  const conversations = Array.from(byTarget.values())
  conversations.sort((a, b) => {
    const aTime = a.messages[a.messages.length - 1]?.createdAt || ''
    const bTime = b.messages[b.messages.length - 1]?.createdAt || ''
    return bTime.localeCompare(aTime)
  })

  res.json(conversations)
})

app.delete('/api/chat/conversations/:targetUserId', authMiddleware, (req: AuthedRequest, res) => {
  const db = readDb()
  const mine = req.userId as string
  const target = routeReqParam(req, 'targetUserId')
  if (!target) {
    res.status(400).json({ message: '缺少目标用户' })
    return
  }

  const before = db.messages.length
  db.messages = db.messages.filter(
    (msg) =>
      !(
        (msg.senderId === mine && msg.receiverId === target) ||
        (msg.senderId === target && msg.receiverId === mine)
      ),
  )
  if (db.messages.length !== before) {
    writeDb(db)
  }
  res.json({ ok: true })
})

app.post('/api/chat/messages/:targetUserId', authMiddleware, (req: AuthedRequest, res) => {
  const { content } = req.body as { content?: string }
  if (!content?.trim()) {
    res.status(400).json({ message: '消息不能为空' })
    return
  }

  const db = readDb()
  const mine = req.userId as string
  const target = routeReqParam(req, 'targetUserId')
  if (!target) {
    res.status(400).json({ message: '缺少目标用户' })
    return
  }

  if (!db.users.some((item) => item.id === target)) {
    res.status(404).json({ message: '聊天对象不存在' })
    return
  }
  if (isBlockedBetween(db, mine, target)) {
    res.status(403).json({ message: '你与该用户存在拉黑关系，无法私聊' })
    return
  }

  const message: DbMessage = {
    id: `m-${Date.now()}`,
    senderId: mine,
    receiverId: target,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  db.messages.push(message)
  writeDb(db)
  res.status(201).json(message)
})

app.post('/api/chat/messages/by-name/:targetName', authMiddleware, (req: AuthedRequest, res) => {
  const { content } = req.body as { content?: string }
  if (!content?.trim()) {
    res.status(400).json({ message: '消息不能为空' })
    return
  }

  const db = readDb()
  const mine = req.userId as string
  const target = db.users.find((item) => item.nickname === routeReqParam(req, 'targetName'))
  if (!target) {
    res.status(404).json({ message: '聊天对象不存在' })
    return
  }
  if (isBlockedBetween(db, mine, target.id)) {
    res.status(403).json({ message: '你与该用户存在拉黑关系，无法私聊' })
    return
  }

  const message: DbMessage = {
    id: `m-${Date.now()}`,
    senderId: mine,
    receiverId: target.id,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  db.messages.push(message)
  writeDb(db)
  res.status(201).json(message)
})

app.listen(port, '0.0.0.0', () => {
  console.log(`[tq-bbs-backend] running on http://localhost:${port}`)
})
