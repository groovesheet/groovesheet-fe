/**
 * Shapes of the backend payloads the shared helpers pass around.
 *
 * Each interface lists the fields the app is known to read and keeps an
 * `unknown` index signature for the rest, so a new backend field never breaks
 * the build but reading one still forces a narrowing check. Every JSON helper
 * in lib/api.ts is generic over its return type, defaulting to these: a caller
 * that knows more can say `fetchAccountSummary<MySummary>(...)`.
 */

export type GetToken = () => Promise<string | null>;
export type SignOut = () => Promise<void>;

export type JsonObject = { [key: string]: unknown };

export interface WorkflowMetadata {
  instrument?: string;
  source?: string;
  title?: string;
  original_filename?: string;
  filename?: string;
  file_name?: string;
  input_filename?: string;
  input_file?: string;
  source_filename?: string;
  source_file?: string;
  name?: string;
  duration_seconds?: number;
  [key: string]: unknown;
}

export interface WorkflowOutputs {
  files?: Record<string, unknown>;
  metadata?: WorkflowMetadata;
  [key: string]: unknown;
}

export interface WorkflowQueue {
  state?: string;
  position?: number;
  capped?: boolean;
  eta_seconds?: number;
  [key: string]: unknown;
}

/** A workflow as returned by /workflow/status/:id and the enriched /workflow/list items. */
export interface Workflow {
  workflow_id?: string;
  id?: string;
  workflow_name?: string;
  status?: string;
  progress?: number;
  created_at?: string;
  completed_at?: string;
  title?: string;
  display_title?: string;
  description?: string;
  display_description?: string;
  original_filename?: string;
  filename?: string;
  file_name?: string;
  input_filename?: string;
  input_file?: string;
  source_filename?: string;
  source_file?: string;
  name?: string;
  duration_seconds?: number;
  library_track_id?: string | null;
  visibility?: string;
  metadata?: WorkflowMetadata;
  outputs?: WorkflowOutputs;
  files?: Record<string, unknown> & { metadata?: WorkflowMetadata };
  queue?: WorkflowQueue;
  [key: string]: unknown;
}

/** /workflow/list: legacy `{ workflow_ids }`, or `{ items, total }` when paged. */
export interface WorkflowListResponse {
  workflow_ids?: string[];
  items?: Workflow[];
  total?: number;
  [key: string]: unknown;
}

export interface OutputAvailability {
  available: boolean;
  fileKey?: string;
}

export interface AvailableOutputs {
  instrument: OutputAvailability;
  transcription: OutputAvailability;
  midi: OutputAvailability;
  score: OutputAvailability;
}

export interface WorkflowType {
  id: 'stems' | 'midi' | 'transcription' | 'score';
  label: string;
  color: string;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string | null;
}

export interface BillingPlan {
  id: string;
  display_name?: string;
  credits_per_month?: number;
  minutes_per_month?: number;
  price_monthly_usd?: number;
  price_annual_usd?: number;
  price_monthly?: number;
  price_annual?: number;
  max_rollover?: number;
  [key: string]: unknown;
}

export interface BillingTopup {
  id: string;
  display_name?: string;
  credits?: number;
  minutes?: number;
  price_usd?: number;
  price?: number;
  priority_queue?: boolean;
  [key: string]: unknown;
}

export interface BillingCatalog {
  plans: BillingPlan[];
  topups: BillingTopup[];
  currency?: string;
  [key: string]: unknown;
}

export interface UserSubscription {
  user_id?: string;
  tier?: string;
  credits_balance?: number;
  balance_seconds?: number;
  balance_minutes?: number;
  is_active?: boolean;
  next_recharge_at?: string | null;
  subscription_id?: string | null;
  customer_id?: string | null;
  [key: string]: unknown;
}

export interface CheckoutSessionSummary {
  amount_cents: number | null;
  value: number | null;
  currency: string | null;
  plan: string | null;
  payment_status: string | null;
  [key: string]: unknown;
}

/** create-checkout-session: a Stripe hosted URL, or the Airwallex SDK parameters. */
export interface CheckoutSession {
  provider?: 'stripe' | 'airwallex' | string;
  session_id?: string;
  url?: string;
  currency?: string;
  client_secret?: string;
  mode?: 'recurring' | 'payment' | string;
  customer_id?: string;
  intent_id?: string;
  [key: string]: unknown;
}

export interface UsageTransaction {
  id: string;
  amount?: number;
  amount_minutes?: number;
  balance_after?: number;
  transaction_type?: string;
  description?: string;
  created_at?: string;
  workflow_id?: string | null;
  [key: string]: unknown;
}

export interface UsageHistoryResponse {
  transactions: UsageTransaction[];
  total?: number;
  [key: string]: unknown;
}

export interface OwnCreatorProfile {
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  links?: Array<{ platform: string; url: string }> | Record<string, string | null>;
  member_since?: string | null;
  [key: string]: unknown;
}

export interface PaymentMethod {
  brand?: string;
  last4?: string;
  exp?: string;
  [key: string]: unknown;
}

export type CampaignStatus =
  | 'default'
  | 'invalid'
  | 'expired'
  | 'signed_in'
  | 'signed_in_ineligible'
  | 'redeemed';

export interface CampaignResponse {
  status: CampaignStatus;
  code: string;
  campaign: JsonObject | null;
  balance_seconds?: number;
  [key: string]: unknown;
}

export interface CampaignClaim {
  status: 'granted' | 'already_claimed';
  credits_granted: number;
  balance_seconds: number;
  [key: string]: unknown;
}

/** An Error carrying the HTTP status, as thrown by the campaign and preview helpers. */
export interface HttpError extends Error {
  status?: number;
  retryAfterSeconds?: number | null;
}

/* ------------------------------------------------------------------ *
 * Public library (Explore) and creator profiles
 * ------------------------------------------------------------------ */

export interface LibraryTrackOwner {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
}

export interface LibraryThumbData {
  stems?: Record<string, number[]>;
  points?: unknown;
  version?: number;
  duration_sec?: number;
  [key: string]: unknown;
}

/** One row of GET /library/tracks and GET /library/tracks/:id. */
export interface LibraryTrack {
  id: string;
  slug?: string | null;
  title: string;
  artist?: string | null;
  album?: string | null;
  year?: number | null;
  visibility?: string;
  duration_sec?: number | null;
  popularity?: number;
  plays?: number;
  downloads?: number;
  source?: string;
  workflow_id?: string | null;
  workflow_name?: string | null;
  youtube_url?: string | null;
  bilibili_url?: string | null;
  published_at?: string | null;
  first_published_at?: string | null;
  created_at?: string | null;
  formats?: string[];
  cover_url?: string | null;
  thumb_url?: string | null;
  preview_urls?: Record<string, string>;
  thumb_data?: LibraryThumbData | null;
  owner?: LibraryTrackOwner | null;
  _fixture?: boolean;
  [key: string]: unknown;
}

export interface LibraryTracksPage {
  tracks: LibraryTrack[];
  next_cursor?: string | null;
  total?: number;
  page?: number;
  pages?: number;
  limit?: number;
  facets?: JsonObject;
  _fixture?: boolean;
  [key: string]: unknown;
}

/** The Explore card model a creator's songs are mapped to (see lib/creatorApi). */
export interface CreatorSongCard {
  id: string;
  title: string;
  artist: string | null | undefined;
  length: number | null | undefined;
  year: number | null;
  coverUrl: string | null;
  previewUrls: Record<string, string>;
  formats: string[];
  thumbData: LibraryThumbData | null;
  parts: string[];
  popularity: number;
  publishedAt: string | null;
  variant: 'sheet' | 'midi' | 'stems';
  plays: number;
  downloads: number;
  visibility: string;
  rollColor: string;
}

export interface CreatorProfile {
  username: string;
  display_name: string;
  avatar_url: string | null;
  initials: string;
  bio: string;
  member_since: string;
  links: { website?: string | null; youtube?: string | null; instagram?: string | null; [key: string]: string | null | undefined };
  is_owner: boolean;
  is_following: boolean;
  stats: { followers: number };
  songs: CreatorSongCard[];
}

export interface FollowState {
  is_following: boolean;
  followers: number;
  [key: string]: unknown;
}
