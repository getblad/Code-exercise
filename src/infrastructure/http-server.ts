import type { Server } from 'node:http';
import { promisify } from 'node:util';
import type { Express } from 'express';

export function startHttpServer(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(server);
    });
  });
}

export async function closeHttpServer(server: Server): Promise<void> {
  const closing = promisify(server.close.bind(server))();
  server.closeIdleConnections();
  await closing;
}
