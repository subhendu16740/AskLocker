-- ============================================================================
-- 061: The documents bucket keeps spreadsheets — .xlsx and .csv
--
-- Business vaults keep their accounts in Excel. The app now reads a
-- spreadsheet when it is added, as it reads a photo, and sends its rows as
-- the document's text (src/lib/spreadsheet.ts,
-- supabase/functions/_shared/spreadsheet-text.ts); the file itself is kept
-- in the documents bucket like any other, to download later.
--
-- The bucket was made by hand in the dashboard with allowed_mime_types
-- PDF, JPEG and PNG, so Storage refuses anything else before any policy is
-- asked. This adds:
--
--   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet   .xlsx
--   text/csv                                                           .csv
--
-- the content types uploadDocument() sends (file-types.ts). An old .xls is
-- not added: the app asks for it to be saved as .xlsx.
--
-- Nothing else changes: the 10 MB file limit (050), the folder and room
-- checks (019, 038, 060) and who may delete a file (047) hold for a
-- spreadsheet as for a PDF. A bucket that allows every type (NULL) is left
-- as it is.
--
-- Apply: paste into the SQL editor — DEV, then PROD — before the release
-- that carries the app's spreadsheets. Safe to run more than once. Where
-- Supabase does not let this role change the bucket, a notice says to add
-- the two types by hand: Storage › documents › Edit bucket › Allowed MIME
-- types.
-- ============================================================================

DO $do$
BEGIN
  UPDATE storage.buckets
     SET allowed_mime_types = (
           SELECT array_agg(DISTINCT t ORDER BY t)
             FROM unnest(allowed_mime_types || ARRAY[
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv'
                  ]::text[]) AS t
         )
   WHERE id = 'documents'
     AND allowed_mime_types IS NOT NULL
     AND NOT (allowed_mime_types @> ARRAY[
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv'
              ]::text[]);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Add the spreadsheet types to the documents bucket by hand: Storage › documents › Edit bucket › Allowed MIME types: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet and text/csv (%).', SQLERRM;
END
$do$;

-- To check afterwards (read-only):
--   select allowed_mime_types from storage.buckets where id = 'documents';
-- {application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
--  image/jpeg, image/jpg, image/png, text/csv}
