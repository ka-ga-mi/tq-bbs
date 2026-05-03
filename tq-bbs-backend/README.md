# tq-bbs-backend

Node.js + TypeScript backend for `tq-bbs-frontend`.

## Quick Start

1. Install dependencies

```bash
pnpm install
```

2. Create env file

```bash
copy .env.example .env
```

3. Run dev server

```bash
pnpm run dev
```

Server default: `http://localhost:3000`

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/posts`
- `GET /api/posts/:id`
- `POST /api/posts` (auth)
- `POST /api/posts/:id/replies` (auth)
- `GET /api/chat/messages/:targetUserId` (auth)
- `POST /api/chat/messages/:targetUserId` (auth)

Auth header:

`Authorization: Bearer <token>`
