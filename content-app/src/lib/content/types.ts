export type Faq = { q: string; a: string };

export type DraftStatus = "review" | "published" | "rejected";
export type SocialPlatform = "linkedin" | "facebook" | "instagram" | "pinterest";
export type SocialStatus = "draft" | "published" | "failed";

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram", "pinterest"];

/** Zernio carries the first two, Upload-Post the image networks. */
export const IMAGE_PLATFORMS: SocialPlatform[] = ["instagram", "pinterest"];

/** Caption ceilings. LinkedIn is the platform limit; Facebook is a taste limit. */
export const SOCIAL_LIMIT: Record<SocialPlatform, number> = {
  linkedin: 3000,
  facebook: 2000,
  instagram: 2200,
  pinterest: 500,
};

export type NewsRef = {
  url: string;
  title: string;
  source: string;
  publishedAt: string | null;
};

export type NewsItem = NewsRef & {
  id: number;
  feed: string;
  summary: string;
  fetchedAt: string;
  score: number | null;
  reason: string;
  usedDraftId: number | null;
};

export type Validation = { errors: string[]; warnings: string[] };

export type Draft = {
  id: number;
  slug: string;
  title: string;
  description: string;
  summary: string;
  category: string;
  image: string;
  faqs: Faq[];
  bodyMarkdown: string;
  status: DraftStatus;
  news: Partial<NewsRef>;
  validation: Partial<Validation>;
  model: string;
  author: string;
  industry: string;
  categories: string[];
  seoKeyword: string;
  seoTitle: string;
  /** YYYY-MM-DD, or null for "the day it is approved". */
  publishDate: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  approvedBy: string | null;
};

export type SocialPost = {
  id: number;
  draftId: number;
  platform: SocialPlatform;
  content: string;
  enabled: boolean;
  status: SocialStatus;
  zernioPostId: string | null;
  platformUrl: string | null;
  error: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

export type Run = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  outcome: string;
  detail: string;
  draftId: number | null;
};
