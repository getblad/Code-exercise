import mongoose from 'mongoose';
import type { Logger } from 'pino';

const SERVER_SELECTION_TIMEOUT_MS = 5000;

export async function connectMongo(uri: string, logger: Logger): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  logger.info('MongoDB connected');

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

export async function pingMongo(): Promise<void> {
  const { db, readyState } = mongoose.connection;
  if (readyState !== mongoose.ConnectionStates.connected || db === undefined) {
    throw new Error('MongoDB is not connected');
  }
  await db.admin().ping();
}

export async function disconnectMongo(): Promise<void> {
  mongoose.connection.removeAllListeners('disconnected');
  await mongoose.disconnect();
}
