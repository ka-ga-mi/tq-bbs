const MENTION_TOKEN = /@([^\s@，。！？,.!?]+)/g

export const extractMentions = (content: string) => {
  if (!content) return []
  const names: string[] = []
  for (const match of content.matchAll(MENTION_TOKEN)) {
    const name = match[1]?.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export const containsMention = (content: string, nickname: string) => {
  if (!content || !nickname) return false
  return extractMentions(content).includes(nickname)
}

export const buildMentionPrefix = (nicknames: string[], content: string) => {
  const existing = new Set(extractMentions(content))
  const unique = nicknames.filter((name, index, arr) => Boolean(name) && arr.indexOf(name) === index && !existing.has(name))
  if (!unique.length) return ''
  return `${unique.map((name) => `@${name}`).join(' ')} `
}

export const latestMentionAt = (
  replies: Array<{ userId?: string; content?: string; createdAt?: string }> | undefined,
  nickname: string,
  myUserId?: string,
) => {
  const times: string[] = []
  ;(replies ?? []).forEach((reply) => {
    if (!reply.createdAt || !reply.content) return
    if (myUserId && reply.userId === myUserId) return
    if (!containsMention(reply.content, nickname)) return
    times.push(reply.createdAt)
  })
  times.sort()
  return times[times.length - 1] || ''
}
