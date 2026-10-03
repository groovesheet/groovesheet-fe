-- Content pipeline tables: tracked industry news, blog drafts held for
-- approval, and the social posts written from each draft.
--
-- Kept apart from src/app/internal/_lib/db/schema.sql because nothing here
-- touches the lead tables. Idempotent: apply it as often as you like.
--
--   psql "$DATABASE_URL_SESSION" -f src/lib/content/schema.sql

CREATE TABLE IF NOT EXISTS content_news (
  id            bigserial PRIMARY KEY,
  url           text NOT NULL UNIQUE,
  title         text NOT NULL,
  source        text NOT NULL DEFAULT '',
  feed          text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  -- 0 to 100, set by the ranking call. NULL until a run has scored it.
  score         integer,
  reason        text NOT NULL DEFAULT '',
  used_draft_id bigint
);
CREATE INDEX IF NOT EXISTS content_news_fetched_idx ON content_news (fetched_at DESC);

CREATE TABLE IF NOT EXISTS content_drafts (
  id            bigserial PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT 'Industry news',
  image         text NOT NULL DEFAULT '/og.png',
  faqs          jsonb NOT NULL DEFAULT '[]',
  body_markdown text NOT NULL DEFAULT '',
  -- review: waiting for a person. published: live on /blog. rejected: binned.
  status        text NOT NULL DEFAULT 'review'
                CHECK (status IN ('review', 'published', 'rejected')),
  -- The story this post was written from: { url, title, source, publishedAt }.
  news          jsonb NOT NULL DEFAULT '{}',
  -- Validator output at generation time: { errors: [], warnings: [] }.
  validation    jsonb NOT NULL DEFAULT '{}',
  model         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  approved_by   text
);
CREATE INDEX IF NOT EXISTS content_drafts_status_idx ON content_drafts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS content_social (
  id             bigserial PRIMARY KEY,
  draft_id       bigint NOT NULL REFERENCES content_drafts (id) ON DELETE CASCADE,
  platform       text NOT NULL CHECK (platform IN ('linkedin', 'facebook')),
  content        text NOT NULL DEFAULT '',
  enabled        boolean NOT NULL DEFAULT true,
  -- draft: not sent. published: live. failed: Zernio or the platform said no.
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'failed')),
  zernio_post_id text,
  platform_url   text,
  error          text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  UNIQUE (draft_id, platform)
);

CREATE TABLE IF NOT EXISTS content_runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger     text NOT NULL DEFAULT 'cron',
  outcome     text NOT NULL DEFAULT 'running',
  detail      text NOT NULL DEFAULT '',
  draft_id    bigint
);

-- Instagram and Pinterest joined LinkedIn and Facebook. CREATE TABLE IF NOT
-- EXISTS never revisits a constraint, so it is replaced here, every time.
ALTER TABLE content_social DROP CONSTRAINT IF EXISTS content_social_platform_check;
ALTER TABLE content_social ADD CONSTRAINT content_social_platform_check
  CHECK (platform IN ('linkedin', 'facebook', 'instagram', 'pinterest'));

-- The editor's metadata panel: byline, audience, topics and search fields.
-- `description` stays the meta description and `summary` the excerpt.
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS author      text   NOT NULL DEFAULT '';
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS industry    text   NOT NULL DEFAULT '';
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS categories  text[] NOT NULL DEFAULT '{}';
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS seo_keyword text   NOT NULL DEFAULT '';
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS seo_title   text   NOT NULL DEFAULT '';
-- The date shown on the post. NULL means "the day it is approved".
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS publish_date date;
CREATE INDEX IF NOT EXISTS content_drafts_categories_idx ON content_drafts USING gin (categories);

-- Images uploaded or pasted into a post, and cover images. Served publicly at
-- /blog-media/<id> with an immutable cache. Kept in Postgres so the pipeline
-- needs no storage service of its own; each file is capped at 4 MB because a
-- Vercel function body tops out at 4.5 MB.
CREATE TABLE IF NOT EXISTS content_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mime       text NOT NULL,
  bytes      bytea NOT NULL,
  size       integer NOT NULL,
  alt        text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
