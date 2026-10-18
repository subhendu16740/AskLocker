-- ============================================================================
-- 055: Someone on a paid plan creates a free business
--
-- 054 gave a person on Free one vault besides their personal vault, a family
-- or a business, and did not count vaults on a paid plan. It counted only
-- the vaults the person created, though, so someone in a family on Family
-- Plus that another member pays for, who had once created a free family of
-- their own, was told "On Free, you can create one family or one business"
-- when creating a business. Found on DEV on 17 October 2026. The owner's
-- rule: someone on Family Plus is not on Free, and the new business starts
-- on Business Free.
--
-- create_family(): the combined number (vaults_per_person) applies only to
-- a person on Free: someone in no vault on a paid plan (Family Plus or a
-- business plan, theirs or someone else's). Everyone keeps 050's and 051's
-- per-kind numbers for free vaults: one free family and one free business.
-- A new vault starts on Free as always; its plan is its own.
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both.
-- Safe to run more than once. Needs 054.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'vaults_per_person') THEN
    RAISE EXCEPTION 'Apply 054_one_free_vault_and_family_to_business.sql first.';
  END IF;
END
$do$;

-- 054's create_family, with the person's paid plans read first.
CREATE OR REPLACE FUNCTION public.create_family(
  p_user_id       uuid,
  p_family_name   character varying,
  p_description   text              DEFAULT NULL::text,
  p_family_icon   character varying DEFAULT NULL::character varying,
  p_is_personal   boolean           DEFAULT false,
  p_kind          text              DEFAULT 'family'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_family_id  uuid;
  v_short_id   text;
  v_storage_ns text;
  v_vector_ns  text;
  v_cap        integer;
  v_vaults     integer;
  v_paid       boolean;
  v_kind       text := coalesce(nullif(btrim(p_kind), ''), 'family');
begin
  perform public.assert_caller_is(p_user_id);

  if v_kind not in ('family', 'business') then
    raise exception 'A vault is a family or a business.' using errcode = '22023';
  end if;
  if coalesce(p_is_personal, false) and v_kind <> 'family' then
    raise exception 'A personal vault is always a family vault.' using errcode = '22023';
  end if;

  -- On Free, a person creates plan_limits.vaults_per_person vaults of either
  -- kind (1, 054) besides their personal vault, and within that
  -- families_per_person families and businesses_per_person businesses. A
  -- vault on a paid plan does not count. Someone in a vault on a paid plan,
  -- theirs or not, is not on Free: the combined number is not theirs, only
  -- the per-kind ones (055). Serialised per
  -- person, so two tabs cannot both make the last one.
  if not coalesce(p_is_personal, false) then
    perform pg_advisory_xact_lock(hashtext('create_family:' || p_user_id::text));
    select pl.vaults_per_person into v_vaults from public.plan_limits pl where pl.plan = 'free';
    v_paid := exists (select 1 from public.family_members m
                       where m.user_id = p_user_id and public.family_plan_now(m.family_id) <> 'free');
    if v_vaults is not null and not v_paid and (
      select count(*) from public.families f
       where f.created_by = p_user_id
         and not coalesce(f.is_personal, false)
         and public.family_plan_now(f.id) = 'free'
    ) >= v_vaults then
      raise exception '%',
        case
          when v_vaults = 0
            then 'On Free, you cannot create a family or a business. Ask someone to invite you instead.'
          when v_vaults = 1
            then 'On Free, you can create one family or one business besides your personal vault. To create another, move the one you created to a paid plan.'
          else format('On Free, you can create %s families or businesses besides your personal vault. To create another, move one you created to a paid plan.', v_vaults)
        end
        using errcode = 'P0001', hint = 'family_limit';
    end if;

    select case when v_kind = 'business' then pl.businesses_per_person else pl.families_per_person end
      into v_cap
      from public.plan_limits pl where pl.plan = 'free';
    if v_cap is not null and (
      select count(*) from public.families f
       where f.created_by = p_user_id
         and not coalesce(f.is_personal, false)
         and f.kind = v_kind
         and public.family_plan_now(f.id) = 'free'
    ) >= v_cap then
      raise exception '%',
        case
          when v_kind = 'business' and v_cap = 0
            then 'On Free, you cannot create a business. Ask your business''s admin to invite you instead.'
          when v_kind = 'business'
            then format('On Free, you can create %s. To create another, move the one you created to a paid plan.',
                        case when v_cap = 1 then 'one business' else v_cap || ' businesses' end)
          when v_cap = 0
            then 'On Free, you cannot create a family. Ask someone in your family to invite you instead.'
          else format('On Free, you can create %s besides your personal vault. To create another, move a family you created to Family Plus.',
                      case when v_cap = 1 then 'one family' else v_cap || ' families' end)
        end
        using errcode = 'P0001', hint = 'family_limit';
    end if;
  end if;

  v_family_id  := gen_random_uuid();
  v_short_id   := replace(left(v_family_id::text, 8), '-', '');
  v_storage_ns := 'family_' || v_short_id;
  v_vector_ns  := 'fv_' || v_short_id;

  insert into public.families (id, name, description, created_by, family_icon, storage_namespace, vector_namespace, is_personal, kind)
  values (v_family_id, p_family_name, p_description, p_user_id, p_family_icon, v_storage_ns, v_vector_ns, p_is_personal, v_kind);

  execute format('create schema %I', v_storage_ns);

  execute format('create table %I.documents (
    id uuid primary key default gen_random_uuid(),
    uploaded_by uuid not null,
    file_name varchar(255) not null,
    file_type varchar(20) not null,
    file_size_bytes bigint,
    storage_path text not null,
    category_id uuid,
    belongs_to_member uuid,
    ocr_text text,
    ingestion_status varchar(20) default ''pending'',
    is_deleted boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )', v_storage_ns);

  execute format('create table %I.document_metadata (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    key varchar(100) not null,
    value text not null,
    auto_extracted boolean default false,
    confidence float
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    chunk_index integer not null,
    content text not null,
    token_count integer,
    embedding_id varchar(100),
    created_at timestamptz default now()
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.expiry_alerts (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    expiry_date date not null,
    alert_days_before integer[] default ''{90, 30, 7}'',
    last_notified_at timestamptz,
    is_expired boolean default false,
    auto_detected boolean default false
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.family_relationships (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null,
    related_to uuid not null,
    relationship_type varchar(50) not null,
    aliases text[]
  )', v_storage_ns);

  execute format('create index idx_%s_docs_category on %I.documents(category_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_docs_member on %I.documents(belongs_to_member)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_docs_status on %I.documents(ingestion_status)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_chunks_doc on %I.document_chunks(document_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_metadata_doc on %I.document_metadata(document_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_metadata_key on %I.document_metadata(key)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_expiry_date on %I.expiry_alerts(expiry_date)', v_short_id, v_storage_ns);

  perform public.upgrade_family_schema_for_search(v_family_id);

  insert into public.family_members (family_id, user_id, role, can_upload, can_delete)
  values (v_family_id, p_user_id, 'admin', true, true);

  insert into public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  values (p_user_id, v_family_id, 'create_family', 'family', v_family_id);

  return v_family_id;
end;
$fn$;


REVOKE ALL ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) TO authenticated, service_role;
