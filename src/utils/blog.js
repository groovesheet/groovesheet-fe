// Blog data source stub.
//
// fetchBlogPosts() is consumed by src/components/Blog.js. Once the actual
// blog content pipeline lands (CMS, MDX, or static JSON), replace this
// implementation with the real fetcher. Until then we resolve to an empty
// list so the Blog page renders its empty-state UI without crashing the
// production build.

export async function fetchBlogPosts() {
  return [];
}

export default { fetchBlogPosts };
