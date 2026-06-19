import { sanitizeAvatarUrlForApi } from './avatar.js'
import type { Database, DbMessage, DbReply } from './types.js'

const sortByCreatedAt = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const sliceAfterId = <T extends { id: string }>(items: T[], afterId?: string) => {
  if (!afterId) return []
  const index = items.findIndex((item) => item.id === afterId)
  if (index < 0) return []
  return items.slice(index + 1)
}

export type ChatPollContact = {
  contactId: string
  contactName: string
  avatarUrl: string
  lastMessageId: string
  lastMessageAt: string
  latestIncomingAt: string
}

export type ChatPollResult = {
  contacts: ChatPollContact[]
  newMessages: Array<Pick<DbMessage, 'id' | 'senderId' | 'content' | 'createdAt'>>
}

export const buildChatPoll = (
  db: Database,
  userId: string,
  contactId?: string,
  afterMessageId?: string,
): ChatPollResult => {
  const byTarget = new Map<string, DbMessage[]>()

  db.messages.forEach((msg) => {
    if (msg.senderId !== userId && msg.receiverId !== userId) return
    const targetId = msg.senderId === userId ? msg.receiverId : msg.senderId
    const list = byTarget.get(targetId) ?? []
    list.push(msg)
    byTarget.set(targetId, list)
  })

  const contacts: ChatPollContact[] = []
  byTarget.forEach((messages, targetId) => {
    const targetUser = db.users.find((item) => item.id === targetId)
    if (!targetUser) return
    const sorted = sortByCreatedAt(messages)
    const last = sorted[sorted.length - 1]
    const incoming = sorted.filter((msg) => msg.senderId !== userId)
    const latestIncoming = incoming[incoming.length - 1]
    contacts.push({
      contactId: targetUser.id,
      contactName: targetUser.nickname,
      avatarUrl: sanitizeAvatarUrlForApi(targetUser.avatarUrl),
      lastMessageId: last?.id || '',
      lastMessageAt: last?.createdAt || '',
      latestIncomingAt: latestIncoming?.createdAt || '',
    })
  })

  contacts.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

  let newMessages: ChatPollResult['newMessages'] = []
  if (contactId && byTarget.has(contactId)) {
    const sorted = sortByCreatedAt(byTarget.get(contactId) ?? [])
    newMessages = sliceAfterId(sorted, afterMessageId).map((msg) => ({
      id: msg.id,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt,
    }))
  }

  return { contacts, newMessages }
}

export type PostRepliesPollResult = {
  replyCount: number
  lastReplyId: string
  isLocked: boolean
  newReplies: Array<
    Pick<DbReply, 'id' | 'userId' | 'userName' | 'avatarUrl' | 'content' | 'createdAt'>
  >
}

export const buildPostRepliesPoll = (
  db: Database,
  postId: string,
  afterReplyId?: string,
): PostRepliesPollResult | null => {
  const post = db.posts.find((item) => item.id === postId)
  if (!post) return null

  const sorted = [...post.replies]
  const newReplies = sliceAfterId(sorted, afterReplyId).map((reply) => ({
    id: reply.id,
    userId: reply.userId,
    userName: reply.userName,
    avatarUrl: sanitizeAvatarUrlForApi(reply.avatarUrl),
    content: reply.content,
    createdAt: reply.createdAt,
  }))

  return {
    replyCount: sorted.length,
    lastReplyId: sorted[sorted.length - 1]?.id || '',
    isLocked: Boolean(post.isLocked),
    newReplies,
  }
}
