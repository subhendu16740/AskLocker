-- ─── 065: the chunks still without a search vector ─────────────────────────
--
-- Search vectors are made by Supabase's own gte-small inside the Edge
-- Functions now (or by Cloudflare once its keys are set), not by
-- HuggingFace, whose free credit ran out. gte-small spends the function's
-- CPU, so a document added makes only as many vectors as fit; the rest of
-- its chunks are stored without one. An index whose rebuild is complete
-- is never walked again, so nothing else would ever reach them.
--
-- rag_chunks_missing_embedding lists them, a few at a time, for the
-- functions to fill in (fillMissingVectors in _shared/reembed.ts, after a
-- question and from reembed-index). Without this migration those chunks
-- stay searchable by keyword, as they were.
--
-- It takes a vault's schema as a parameter and checks no membership, like
-- every rag_* function, so it is service role only (CLAUDE.md, point 1).
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rag_chunks_missing_embedding(
  p_schema TEXT,
  p_limit  INTEGER DEFAULT 16
)
RETURNS TABLE(id UUID, content TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT c.id, c.content
     FROM %I.document_chunks c
     JOIN %I.documents d ON d.id = c.document_id
     WHERE d.is_deleted = false
       AND c.embedding IS NULL
       AND length(btrim(c.content)) > 0
     ORDER BY c.id
     LIMIT $1',
    p_schema, p_schema
  ) USING least(greatest(coalesce(p_limit, 16), 1), 64);
END;
$function$;

REVOKE ALL ON FUNCTION public.rag_chunks_missing_embedding(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rag_chunks_missing_embedding(TEXT, INTEGER) TO service_role;
