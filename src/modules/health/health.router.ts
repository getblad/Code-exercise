import { Router } from 'express';
import { ServiceUnavailableError } from '../../errors/app-error';

export function createHealthRouter(checkDatabase: () => Promise<void>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await checkDatabase();
    } catch (cause) {
      throw new ServiceUnavailableError('Database unavailable', { cause });
    }
    res.json({ status: 'ok' });
  });

  return router;
}
