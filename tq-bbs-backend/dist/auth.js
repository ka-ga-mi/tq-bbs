import jwt from 'jsonwebtoken';
export const signToken = (userId, secret) => jwt.sign({ userId }, secret, { expiresIn: '7d' });
export const verifyToken = (token, secret) => jwt.verify(token, secret);
