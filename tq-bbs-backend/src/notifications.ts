import type { Database } from './types.js'

const MENTION_TOKEN = /@([^\s@，。！？,.!?]+)/g

const extractMentions = (content: string) => {
  const names: string[] = []
  for (const match of content.matchAll(MENTION_TOKEN)) {
    const name = match[1]?.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

const containsMention = (content: string, nickname: string) => {
  if (!content || !nickname) return false
  return extractMentions(content).includes(nickname)
}

export type NotificationSummary = {
  chat: Array<{ contactId: string; latestIncomingAt: string }>
  myPostReplies: Array<{ postId: string; latestIncomingAt: string }>
  followPostReplies: Array<{ postId: string; latestIncomingAt: string }>
  mentions: Array<{ postId: string; latestMentionAt: string }>
}

export const buildNotificationSummary = (db: Database, userId: string): NotificationSummary | null => {
  const user = db.users.find((item) => item.id === userId)
  if (!user) return null

  const nickname = user.nickname
  const followingIds = new Set(
    db.follows.filter((item) => item.followerId === userId).map((item) => item.followeeId),
  )

  const chatLatest = new Map<string, string>()
  db.messages.forEach((msg) => {
    if (msg.receiverId !== userId || msg.senderId === userId) return
    const prev = chatLatest.get(msg.senderId) || ''
    if (msg.createdAt > prev) chatLatest.set(msg.senderId, msg.createdAt)
  })

  const myPostReplies: NotificationSummary['myPostReplies'] = []
  const followPostReplies: NotificationSummary['followPostReplies'] = []
  const mentions: NotificationSummary['mentions'] = []

  db.posts.forEach((post) => {
    const authorId = post.replies[0]?.userId
    const isMyPost = authorId === userId
    const isFollowPost = Boolean(authorId && followingIds.has(authorId))

    let latestOthersReply = ''
    let latestMention = ''

    post.replies.forEach((reply) => {
      if (reply.userId === userId || !reply.createdAt) return
      if (reply.createdAt > latestOthersReply) latestOthersReply = reply.createdAt
      if (reply.content && containsMention(reply.content, nickname) && reply.createdAt > latestMention) {
        latestMention = reply.createdAt
      }
    })

    if (isMyPost && latestOthersReply) {
      myPostReplies.push({ postId: post.id, latestIncomingAt: latestOthersReply })
    }
    if (isFollowPost && latestOthersReply) {
      followPostReplies.push({ postId: post.id, latestIncomingAt: latestOthersReply })
    }
    if (latestMention) {
      mentions.push({ postId: post.id, latestMentionAt: latestMention })
    }
  })

  return {
    chat: Array.from(chatLatest.entries()).map(([contactId, latestIncomingAt]) => ({
      contactId,
      latestIncomingAt,
    })),
    myPostReplies,
    followPostReplies,
    mentions,
  }
}
