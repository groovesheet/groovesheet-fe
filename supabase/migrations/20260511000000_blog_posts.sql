-- GrooveSheet blog CMS schema
-- Apply via Supabase Studio SQL Editor on project jdchaxhcwqvyfzpaktuf

-- =========================================================
-- 1. Table
-- =========================================================
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text not null default '',
  body_md         text not null default '',
  cover_image_url text,
  author          text not null default 'GrooveSheet Team',
  read_time_min   integer not null default 5,
  featured        boolean not null default false,
  size            text not null default 'medium' check (size in ('small','medium','large')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists blog_posts_published_at_idx
  on public.blog_posts (published_at desc) where published_at is not null;

create index if not exists blog_posts_featured_idx
  on public.blog_posts (featured) where featured = true;

-- =========================================================
-- 2. updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- =========================================================
-- 3. RLS
-- =========================================================
alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published posts" on public.blog_posts;
create policy "Public can read published posts"
  on public.blog_posts
  for select
  using (published_at is not null and published_at <= now());

-- Writes are restricted to service_role only (Studio + admin tools use this).
-- No anon/authenticated insert/update/delete policies = denied by default.

-- =========================================================
-- 4. Storage bucket for cover images
-- =========================================================
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can read blog images" on storage.objects;
create policy "Public can read blog images"
  on storage.objects for select
  using (bucket_id = 'blog-images');
