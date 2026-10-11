import { Router } from 'express';
import { decodeCursor, encodeCursor, setNextPageLink } from '../../http/pagination';
import { getPrincipal } from '../../middleware/require-auth';
import { parseInput } from '../../validation/parse-input';
import { toBookResponse } from '../books/book.mapper';
import { feedCursorSchema, feedQuerySchema } from './feed.schemas';
import type { FeedService } from './feed.service';

export function createFeedRouter(feed: FeedService): Router {
  const router = Router();

  router.get('/feed', async (req, res) => {
    const { limit, cursor } = parseInput(feedQuerySchema, req.query);
    const after = cursor === undefined ? undefined : decodeCursor(feedCursorSchema, cursor);

    const page = await feed.getFeed(getPrincipal(req), after, limit);

    setNextPageLink(req, res, page.next === undefined ? undefined : encodeCursor(page.next));
    res.json(page.items.map(toBookResponse));
  });

  return router;
}
