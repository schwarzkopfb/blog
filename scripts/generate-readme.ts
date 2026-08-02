import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readBio } from "../src/lib/bio";
import { collectPosts, groupPosts } from "../src/lib/posts";
import { generateReadme } from "../src/lib/readme";

const root = process.cwd();
const readmePath = path.join(root, "README.md");

try {
  const [bio, posts, currentReadme] = await Promise.all([
    readBio(root),
    collectPosts(root),
    readFile(readmePath, "utf8"),
  ]);
  const nextReadme = generateReadme(currentReadme, bio, posts);

  if (nextReadme === currentReadme) {
    console.log("README.md is current.");
  } else {
    await writeFile(readmePath, nextReadme, "utf8");
    console.log(`Updated README.md with ${groupPosts(posts).length} posts.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
