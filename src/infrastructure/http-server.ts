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
    // Once close() has run, drop each keep-alive connection as soon as its last response is sent
    server.on('request', (_req, res) => {
      res.once('finish', () => {
        if (!server.listening) server.closeIdleConnections();
      });
    });
  });
}

export async function closeHttpServer(server: Server): Promise<void> {
  await promisify(server.close.bind(server))();
}
