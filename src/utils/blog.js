import { supabase } from '../auth';

const SELECT_LIST_FIELDS =
  'id, slug, title, excerpt, cover_image_url, author, read_time_min, featured, size, published_at';

const SELECT_DETAIL_FIELDS =
  'id, slug, title, excerpt, body_md, cover_image_url, author, read_time_min, featured, size, published_at';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toPostListItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    coverImageUrl: row.cover_image_url || null,
    author: row.author,
    readTime: `${row.read_time_min} min read`,
    featured: row.featured,
    size: row.size,
    date: formatDate(row.published_at),
    publishedAt: row.published_at,
  };
}

function toPostDetail(row) {
  return {
    ...toPostListItem(row),
    bodyMd: row.body_md || '',
  };
}

export async function fetchBlogPosts() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT_LIST_FIELDS)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(toPostListItem);
}

export async function fetchBlogPostBySlug(slug) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT_DETAIL_FIELDS)
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toPostDetail(data);
}
