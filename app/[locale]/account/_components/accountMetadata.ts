/**
 * Server-side metadata for the Tier C routes. Private to P4.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/metadata';

/**
 * Metadata for a per-user page: its own title, and noindex, because the HTML
 * is an empty shell until the signed-in browser fills it in.
 */
export function accountMetadata(title: string, path: string, locale: string, description?: string): Metadata {
  return pageMetadata({ title, description, path, locale, noindex: true });
}
