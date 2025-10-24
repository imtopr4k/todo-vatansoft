import mongoose from 'mongoose';
import { env } from './env';

export async function connectMongo() {
  await mongoose.connect(env.MONGO_URI);
  console.log('[mongo] connected');
}
