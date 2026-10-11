import { Router } from 'express';
import { decodeCursor, encodeCursor, setNextPageLink } from '../../http/pagination';
import { getPrincipal } from '../../middleware/require-auth';
import { parseInput } from '../../validation/parse-input';
import { toBookResponse } from './book.mapper';
import {
  bookCursorSchema,
  bookIdParamsSchema,
  bookInputSchema,
  listBooksQuerySchema,
} from './book.schemas';
import type { BookService } from './book.service';

export function createBookRouter(books: BookService): Router {
  const router = Router();

  router.post('/books', async (req, res) => {
    const book = await books.create(getPrincipal(req), parseInput(bookInputSchema, req.body));
    res.status(201).location(`/books/${book.id}`).json(toBookResponse(book));
  });

  router.get('/books', async (req, res) => {
    const { libraryId, limit, cursor } = parseInput(listBooksQuerySchema, req.query);
    const afterId =
      cursor === undefined ? undefined : decodeCursor(bookCursorSchema, cursor).afterId;

    const page = await books.list(getPrincipal(req), { libraryId, afterId, limit });

    const nextCursor =
      page.nextAfterId === undefined ? undefined : encodeCursor({ afterId: page.nextAfterId });
    setNextPageLink(req, res, nextCursor);
    res.json(page.items.map(toBookResponse));
  });

  router.get('/books/:id', async (req, res) => {
    const { id } = parseInput(bookIdParamsSchema, req.params);
    res.json(toBookResponse(await books.get(getPrincipal(req), id)));
  });

  router.put('/books/:id', async (req, res) => {
    const { id } = parseInput(bookIdParamsSchema, req.params);
    const input = parseInput(bookInputSchema, req.body);
    res.json(toBookResponse(await books.replace(getPrincipal(req), id, input)));
  });

  router.delete('/books/:id', async (req, res) => {
    const { id } = parseInput(bookIdParamsSchema, req.params);
    await books.delete(getPrincipal(req), id);
    res.status(204).end();
  });

  return router;
}
