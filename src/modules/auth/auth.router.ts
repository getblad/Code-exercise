import { Router } from 'express';
import { createLoginRateLimiter } from '../../middleware/rate-limit';
import { parseInput } from '../../validation/parse-input';
import { loginSchema } from './auth.schemas';
import type { AuthService } from './auth.service';

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();

  router.post('/login', createLoginRateLimiter(), async (req, res) => {
    const { username, password } = parseInput(loginSchema, req.body);
    res.json(await auth.login(username, password));
  });

  return router;
}
