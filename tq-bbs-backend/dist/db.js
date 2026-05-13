import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../data/db.json');
const createDefaultDb = () => ({
    users: [],
    posts: [],
    messages: [],
    follows: [],
    blocks: [],
});
export const readDb = () => {
    if (!fs.existsSync(DATA_PATH)) {
        fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        const initial = createDefaultDb();
        fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    if (!raw.trim())
        return createDefaultDb();
    try {
        const parsed = JSON.parse(raw);
        const users = (parsed.users ?? []).map((item) => ({
            ...item,
            role: (item.role === 'admin' ? 'admin' : 'user'),
        }));
        if (users.length > 0 && !users.some((item) => item.role === 'admin')) {
            const head = users.at(0);
            if (head)
                head.role = 'admin';
        }
        const posts = (parsed.posts ?? []).map((item) => ({
            ...item,
            isFeatured: Boolean(item.isFeatured || item.type === '精品'),
            isPinned: Boolean(item.isPinned),
            isLocked: Boolean(item.isLocked),
        }));
        const result = {
            users,
            posts,
            messages: parsed.messages ?? [],
            follows: parsed.follows ?? [],
            blocks: parsed.blocks ?? [],
        };
        return result;
    }
    catch {
        return createDefaultDb();
    }
};
export const writeDb = (db) => {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf-8');
};
