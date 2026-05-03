import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.resolve(__dirname, '../data/db.json')

const createDefaultDb = (): Database => ({
  users: [],
  posts: [],
  messages: [],
  follows: [],
  blocks: [],
})

export const readDb = (): Database => {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
    const initial = createDefaultDb()
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }

  const raw = fs.readFileSync(DATA_PATH, 'utf-8')
  if (!raw.trim()) return createDefaultDb()

  try {
    const parsed = JSON.parse(raw) as Database
    const users = (parsed.users ?? []).map((item) => ({
      ...item,
      role: item.role === 'admin' ? 'admin' : 'user',
    }))
    if (users.length > 0 && !users.some((item) => item.role === 'admin')) {
      users[0].role = 'admin'
    }
    return {
      users,
      posts: (parsed.posts ?? []).map((item) => ({
        ...item,
        isFeatured: Boolean(item.isFeatured || item.type === '精品'),
        isPinned: Boolean(item.isPinned),
        isLocked: Boolean(item.isLocked),
      })),
      messages: parsed.messages ?? [],
      follows: parsed.follows ?? [],
      blocks: parsed.blocks ?? [],
    }
  } catch {
    return createDefaultDb()
  }
}

export const writeDb = (db: Database) => {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf-8')
}
