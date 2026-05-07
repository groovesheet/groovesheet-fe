# Blog

**Source of truth:** `src/components/Blog.js` (+ `Blog.css`)
**Visual reference:** —
**Status:** documented

The `/blog` page. Static array of post stubs (no real CMS yet) rendered in a varied grid: `featured` posts at `large` size, others at `medium`.

## Anatomy

```
<page>
  <Header onLoginClick={...} />
  <main>
    [Page header / title]
    <grid of blog cards>
      <card>          ← driven by post.size: 'large' | 'medium'
        title
        date · read time
        excerpt (only on medium-size cards)
  <Footer />
```

## Variants & states

| Variant | When |
|---|---|
| `featured: true, size: 'large'` | Hero-style cards at the top |
| `size: 'medium'` | Smaller cards with excerpt text |

## Data shape

```js
const blogPosts = [
  { id, title, date, readTime, excerpt, featured, size },
  ...
];
```

Posts are currently in-source. When a real CMS lands, refactor `blogPosts` to be fetched and remove the hard-coded array.

## Props

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Forwarded to Header |

## Tokens used

`var(--color-panel1)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-primary)`.

## Tone & copy rules

- Post titles: **Title Case** ("The Future of Drum Transcription: How AI Is Changing Music Education")
- Dates: **"DD MMM YYYY"** ("12 Nov 2025") — sentence case month abbreviation
- Read time: **"N min read"** (lowercase "min")
- Excerpts: sentence case, often start mid-thought
- Use of curly apostrophe in titles (`GrooveSheet's`) — keep, don't normalize to straight `'`

## Do / Don't

- **Do** keep the `featured` + `size` two-axis structure when adding posts. Two `featured: true` at top, then a flowing medium grid.
- **Do** preserve the date format consistently.
- **Don't** add real article content here — when it ships, route to `/blog/:slug` and fetch from the CMS.

## Drift from generated spec

No preview reference. Card grid is FE-original.
