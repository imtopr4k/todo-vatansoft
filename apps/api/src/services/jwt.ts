import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface JwtPayload {
  sub: string;
  role: 'agent' | 'supervisor';
}

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '2h' });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
