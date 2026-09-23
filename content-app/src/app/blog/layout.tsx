import { BLOG_THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

/* The blog takes the main site's theme rule rather than this app's.

   The root layout's boot script applies a stored choice and otherwise leaves
   the operating system in charge, which is right for /internal. A public page
   is different: someone arrives here from /explore or /pricing in the same
   visit, and those force dark unless the visitor has chosen light. This script
   runs at the top of the body, before the blog paints, and reads the same
   localStorage key, so the two halves of the site agree. */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BLOG_THEME_BOOT_SCRIPT }} />
      {children}
    </>
  );
}
