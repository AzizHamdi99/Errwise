-- Title search is ILIKE '%term%', which a btree index cannot serve. A trigram GIN index can.
-- pg_trgm ships with PostgreSQL and is supported by Neon. If the role cannot create it, this
-- migration fails as a whole and nothing is applied. Backward compatible: old code does not
-- depend on the index, it only gets faster.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Issue_title_trgm_idx" ON "Issue" USING GIN ("title" gin_trgm_ops);
