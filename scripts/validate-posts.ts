import { collectPosts, groupPosts } from "../src/lib/posts";

try {
  const posts = await collectPosts();
  console.log(`Validated ${posts.length} post files across ${groupPosts(posts).length} posts.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
