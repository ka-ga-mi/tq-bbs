import jwt from 'jsonwebtoken'

export const signToken = (userId: string, secret: string) =>
  jwt.sign({ userId }, secret, { expiresIn: '7d' })

export const verifyToken = (token: string, secret: string) => jwt.verify(token, secret) as { userId: string }
