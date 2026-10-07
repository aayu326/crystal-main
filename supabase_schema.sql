-- Crystal kgr-t Selfie Campaign — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  state text not null,
  district text not null,
  used_crystal_products boolean not null default false,
  consent boolean not null default false,
  language text not null default 'en' check (language in ('en', 'hi', 'mr')),
  created_at timestamptz not null default now()
);

create index if not exists idx_registrations_created_at on public.registrations (created_at desc);
create index if not exists idx_registrations_state on public.registrations (state);
create index if not exists idx_registrations_mobile on public.registrations (mobile);

-- ---------------------------------------------------------------------
-- portraits
-- ---------------------------------------------------------------------
create table if not exists public.portraits (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations (id) on delete cascade,
  ref_no text not null unique,
  original_photo_url text,
  generated_image_url text,
  template_id text not null default 'kgr-t-jivora-2026',
  created_at timestamptz not null default now()
);

create index if not exists idx_portraits_created_at on public.portraits (created_at desc);
create index if not exists idx_portraits_ref_no on public.portraits (ref_no);
create index if not exists idx_portraits_registration_id on public.portraits (registration_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.registrations enable row level security;
alter table public.portraits enable row level security;

-- Public (anon) INSERT only — the campaign form writes rows, it never reads them back in bulk.
create policy "Public can insert registrations"
  on public.registrations for insert
  to anon
  with check (true);

create policy "Public can insert portraits"
  on public.portraits for insert
  to anon
  with check (true);

-- Allow the anon key to check ref_no uniqueness (SELECT of a single column) before generating one.
create policy "Public can check ref_no uniqueness"
  on public.portraits for select
  to anon
  using (true);

-- Admin dashboard reads: swap `anon` for an authenticated role once you wire up
-- real auth (see README "Securing /admin"). For a quick internal launch you can
-- temporarily allow anon SELECT on registrations too — NOT recommended for prod:
-- create policy "Temporary admin read" on public.registrations for select to anon using (true);

-- ---------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('campaign-photos', 'campaign-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('generated-portraits', 'generated-portraits', true)
on conflict (id) do nothing;

create policy "Public can upload campaign photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'campaign-photos');

create policy "Public can upload generated portraits"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'generated-portraits');

create policy "Public can read campaign photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'campaign-photos');

create policy "Public can read generated portraits"
  on storage.objects for select
  to anon
  using (bucket_id = 'generated-portraits');

-- Consider a scheduled Edge Function / pg_cron job to delete objects and rows
-- older than 90 days from campaign-photos + registrations, per the privacy
-- notice shown in the UI ("Your photo stays private and is deleted after 90 days").


-- ---------------------------------------------------------------------------
-- Public live counter on the home page (returns only a number, no rows).
-- ---------------------------------------------------------------------------
create or replace function public.get_portrait_count()
returns bigint
language sql
security definer
set search_path = public
as $$ select count(*) from public.portraits $$;

grant execute on function public.get_portrait_count() to anon, authenticated;
