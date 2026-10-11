# 0012. Books API contract: access rules, PUT, pagination, validation

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D12, D13, D14, D15 · **Implemented in:** T5 (pagination reused by the feed in T6)

## Context

The assignment asks for full CRUD on books, with input validation and the rule that "users can only create or view books in libraries they are members of". It leaves open what happens at the edges: which status codes to use, how updates work, how to page through millions of rows, and how strict validation should be.

## Decision

**Endpoints**

| Method | Path         | Success          | Notes                        |
| ------ | ------------ | ---------------- | ---------------------------- |
| POST   | `/books`     | 201 + `Location` |                              |
| GET    | `/books`     | 200, JSON array  | `?libraryId=&limit=&cursor=` |
| GET    | `/books/:id` | 200              |                              |
| PUT    | `/books/:id` | 200              | full replacement             |
| DELETE | `/books/:id` | 204              |                              |

**Access rules (D12)**

- Every operation is scoped to `req.principal.libraryIds`, loaded fresh on each request.
- Reads, updates and deletes by id query `{ _id, library: { $in: libraryIds } }`. A book in another library is indistinguishable from a missing one: **404**, so ids cannot be probed.
- Naming a library you don't belong to returns **403**. That covers creating a book there, filtering by it with `?libraryId=`, and moving a book there with `PUT`. A `PUT` move therefore requires membership in both libraries: the source through scoping, the target through the check.
- The `admin` role grants nothing extra; the assignment defines no admin powers.

**Update method (D13)**

- `PUT` replaces the whole book and is validated by the same schema as create. An omitted `authorCountry` becomes `null`.
- `rankScore` is recomputed from the new pages and date and written in the same atomic `findOneAndUpdate`.

**Pagination and response shape (D14)**

- List bodies are plain JSON arrays: the feed must "return an empty array" when nothing matches, and both lists share one convention.
- Pages are fetched with keyset pagination: `limit` defaults to 20 (maximum 100), and `cursor` is opaque base64url JSON. `/books` orders by `_id` descending and uses the `library_recent` index.
- The service fetches `limit + 1` rows to know whether another page exists. If one does, the response carries `Link: </books?...&cursor=…>; rel="next"` (RFC 8288), as a URL relative to the request so it never depends on the `Host` header.
- Cursors are validated against a schema. A tampered cursor returns 400 with a `cursor` field error. They don't need signing: access is decided by the token, not the cursor.

**Validation (D15)**

- Bodies use strict zod schemas, so unknown fields return 400.
  - `title`, `author`: trimmed, 1–200 characters.
  - `authorCountry`: optional, two letters, upper-cased.
  - `publishedDate`: `YYYY-MM-DD`, stored as UTC midnight, not in the future.
  - `pages`: integer, 1–100,000.
  - `libraryId`: 24-hex id.
- Ids in the path and query are checked as 24-hex strings before any query runs, so a malformed id returns 400 instead of a Mongoose `CastError`.
- Each failure appears in `errors[]` with its field path.

**Response shape**

- `{ id, title, author, authorCountry, publishedDate: "YYYY-MM-DD", pages, libraryId }`.
- `rankScore` stays internal.

## Alternatives considered

- **403 for books in other libraries** — reveals which ids exist.
- **`PATCH`** — partial updates need a read-modify-write to recompute `rankScore`.
- **`{ items, nextCursor }` envelope** — easy to discover, but contradicts the feed's "return an empty array".
- **Offset pagination** — cost grows with page depth, which is too slow at millions of rows.
- **Silently dropping unknown fields** — hides client typos.

## Consequences

- Every query carries the library scope, so a missing check cannot leak another library's book.
- Clients follow `Link` headers instead of computing offsets. Deep pages cost the same as the first.
- A `PUT` must resend every field.
