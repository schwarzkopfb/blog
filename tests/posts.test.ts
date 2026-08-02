import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectPosts,
  extractPostTitle,
  getPostNeighbors,
  groupPosts,
  parsePostPath,
  PostValidationError,
  sortPosts,
  type Post,
} from "../src/lib/posts";
import {
  BIO_END,
  BIO_START,
  formatReadmePostList,
  generateReadme,
  POSTS_END,
  POSTS_START,
} from "../src/lib/readme";
import { validateBio } from "../src/lib/bio";

function post(sourcePath: string, title = "A title"): Post {
  return parsePostPath(sourcePath, title);
}

const bio = validateBio("Short introduction.");

test("parses a valid post path and derives its route", () => {
  const result = post("2026/08/02/arc-raiders.md", "ARC Raiders");
  assert.deepEqual(result, {
    sourcePath: "2026/08/02/arc-raiders.md",
    id: "2026/08/02/arc-raiders",
    route: "/2026/08/02/arc-raiders",
    date: "2026-08-02",
    year: "2026",
    month: "08",
    day: "02",
    slug: "arc-raiders",
    baseSlug: "arc-raiders",
    variant: null,
    canonicalId: "2026/08/02/arc-raiders",
    title: "ARC Raiders",
    pathLabel: "2026 / 08 / 02 / ARC-RAIDERS",
  });
});

test("normalizes Windows path separators", () => {
  assert.equal(post("2026\\08\\02\\arc-raiders.md").sourcePath, "2026/08/02/arc-raiders.md");
});

test("rejects an invalid month", () => {
  assert.throws(() => post("2026/13/02/post.md"), /Month must be between 01 and 12/);
});

test("rejects an invalid day", () => {
  assert.throws(() => post("2026/01/00/post.md"), /Day 00 does not exist/);
});

test("rejects an impossible calendar date", () => {
  assert.throws(() => post("2026/02/30/post.md"), /Day 30 does not exist in 2026-02/);
});

test("accepts February 29 in a leap year", () => {
  assert.equal(post("2024/02/29/post.md").date, "2024-02-29");
});

test("rejects year zero as a non-civil date", () => {
  assert.throws(() => post("0000/01/01/post.md"), /real civil year/);
});

test("rejects uppercase slug characters", () => {
  assert.throws(() => post("2026/08/02/Arc-Raiders.md"), /lowercase-kebab-case/);
});

test("parses a variant postfix and retains a distinct route", () => {
  const result = post("2026/08/02/arc-raiders_hu.md", "ARC Raiders magyarul");
  assert.equal(result.slug, "arc-raiders_hu");
  assert.equal(result.baseSlug, "arc-raiders");
  assert.equal(result.variant, "hu");
  assert.equal(result.canonicalId, "2026/08/02/arc-raiders");
  assert.equal(result.route, "/2026/08/02/arc-raiders_hu");
});

test("accepts arbitrary lowercase variant postfixes", () => {
  assert.equal(post("2026/08/02/post_pt-br.md").variant, "pt-br");
  assert.equal(post("2026/08/02/post_v2.md").variant, "v2");
});

test("rejects malformed variant postfixes", () => {
  assert.throws(() => post("2026/08/02/arc-raiders_.md"), /optional variant postfix/);
  assert.throws(() => post("2026/08/02/arc-raiders_hu_extra.md"), /optional variant postfix/);
  assert.throws(() => post("2026/08/02/arc-raiders_HU.md"), /optional variant postfix/);
});

test("rejects incorrect post directory depth", () => {
  assert.throws(() => post("2026/08/02/notes/arc-raiders.md"), /Expected: YYYY\/MM\/DD/);
});

test("rejects nonstandard Markdown extensions", () => {
  assert.throws(() => post("2026/08/02/arc-raiders.markdown"), /Expected: YYYY\/MM\/DD/);
  assert.throws(() => post("2026/08/02/arc-raiders.MD"), /Expected: YYYY\/MM\/DD/);
});

test("rejects a missing first-line H1", () => {
  assert.throws(() => extractPostTitle("Plain text", "post.md"), /Every post must begin/);
});

test("rejects an H2 on the first line", () => {
  assert.throws(() => extractPostTitle("## Wrong level", "post.md"), /Received:\n\n  ## Wrong level/);
});

test("rejects blank content before the H1", () => {
  assert.throws(() => extractPostTitle("\n# Too late", "post.md"), /\(empty line\)/);
});

test("rejects frontmatter before the H1", () => {
  assert.throws(() => extractPostTitle("---\ntitle: Wrong\n---", "post.md"), /Received:\n\n  ---/);
});

test("rejects an empty H1", () => {
  assert.throws(() => extractPostTitle("#", "post.md"), /non-empty H1/);
  assert.throws(() => extractPostTitle("#   ", "post.md"), /non-empty H1/);
});

test("extracts the exact title text", () => {
  assert.equal(extractPostTitle("# A precise title\n\nBody"), "A precise title");
});

test("preserves Unicode and punctuation in a title", () => {
  const title = "Árvíztűrő tükörfúrógép: why? Yes!";
  assert.equal(extractPostTitle(`# ${title}\n`), title);
});

test("sorts posts reverse chronologically", () => {
  const sorted = sortPosts([
    post("2023/03/04/old.md"),
    post("2026/08/02/new.md"),
    post("2026/07/02/middle.md"),
  ]);
  assert.deepEqual(sorted.map(({ slug }) => slug), ["new", "middle", "old"]);
});

test("sorts same-day posts deterministically by slug", () => {
  const sorted = sortPosts([
    post("2026/08/02/zebra.md"),
    post("2026/08/02/alpha.md"),
  ]);
  assert.deepEqual(sorted.map(({ slug }) => slug), ["alpha", "zebra"]);
});

test("groups sorted variants under one canonical post", () => {
  const groups = groupPosts([
    post("2026/08/02/arc-raiders_nl.md"),
    post("2026/08/02/another-post.md"),
    post("2026/08/02/arc-raiders.md"),
    post("2026/08/02/arc-raiders_hu.md"),
  ]);

  assert.deepEqual(groups.map((group) => group.canonical.slug), ["another-post", "arc-raiders"]);
  assert.deepEqual(groups[1]!.variants.map((variant) => variant.variant), ["hu", "nl"]);
});

test("rejects a variant without its canonical post", () => {
  assert.throws(
    () => groupPosts([post("2026/08/02/arc-raiders_hu.md")]),
    /requires canonical post 2026\/08\/02\/arc-raiders\.md/,
  );
});

test("derives chronological neighbors for newest, middle, and oldest posts", () => {
  const posts = sortPosts([
    post("2023/03/04/oldest.md"),
    post("2025/06/01/middle.md"),
    post("2026/08/02/newest.md"),
  ]);

  assert.deepEqual(getPostNeighbors(posts, posts[0]!.id), {
    previous: posts[1],
    next: null,
  });
  assert.deepEqual(getPostNeighbors(posts, posts[1]!.id), {
    previous: posts[2],
    next: posts[0],
  });
  assert.deepEqual(getPostNeighbors(posts, posts[2]!.id), {
    previous: null,
    next: posts[1],
  });
});

test("omits both chronological neighbors when only one post exists", () => {
  const onlyPost = post("2026/08/02/only-post.md");
  assert.deepEqual(getPostNeighbors([onlyPost], onlyPost.id), {
    previous: null,
    next: null,
  });
});

test("uses deterministic same-day ordering for chronological neighbors", () => {
  const posts = sortPosts([
    post("2026/08/02/zebra.md"),
    post("2026/08/02/alpha.md"),
  ]);
  assert.equal(getPostNeighbors(posts, posts[0]!.id).previous?.slug, "zebra");
  assert.equal(getPostNeighbors(posts, posts[1]!.id).next?.slug, "alpha");
});

test("derives variant-page chronology from canonical posts only", () => {
  const variant = post("2026/08/02/newest_hu.md");
  const groups = groupPosts([
    post("2025/06/01/older.md"),
    post("2026/08/02/newest.md"),
    variant,
  ]);
  const canonicalPosts = groups.map((group) => group.canonical);

  assert.equal(getPostNeighbors(canonicalPosts, variant.canonicalId).previous?.slug, "older");
  assert.equal(getPostNeighbors(canonicalPosts, variant.canonicalId).next, null);
});

test("rejects neighbor lookup for a post outside the collected list", () => {
  assert.throws(() => getPostNeighbors([], "2026/08/02/missing"), /not in the collected post list/);
});

test("formats README source links and escapes link labels", () => {
  const list = formatReadmePostList([
    post("2026/08/02/arc-raiders.md", "A [test] \\ title"),
  ]);
  assert.equal(
    list,
    "- `2026-08-02` [A \\[test\\] \\\\ title](./2026/08/02/arc-raiders.md)",
  );
});

test("formats one README entry with separately linked variants", () => {
  const list = formatReadmePostList([
    post("2026/08/02/arc-raiders_nl.md", "Nederlands"),
    post("2026/08/02/arc-raiders.md", "English title"),
    post("2026/08/02/arc-raiders_hu.md", "Magyar cím"),
  ]);
  assert.equal(
    list,
    "- `2026-08-02` [English title](./2026/08/02/arc-raiders.md) \\[[HU](./2026/08/02/arc-raiders_hu.md), [NL](./2026/08/02/arc-raiders_nl.md)\\]",
  );
});

test("preserves README content outside the generated markers", () => {
  const current = `# Blog\n\nIntro.\n\n${POSTS_START}\n\nOld\n\n${POSTS_END}\n\nFooter.\n`;
  const generated = generateReadme(current, bio, [post("2026/08/02/new.md", "New")]);
  assert.ok(generated.startsWith(`# Blog\n\nIntro.\n\n${BIO_START}`));
  assert.ok(generated.endsWith(`${POSTS_END}\n\nFooter.\n`));
  assert.match(generated, /\.\/2026\/08\/02\/new\.md/);
});

test("leaves an already-current README unchanged", () => {
  const posts = [post("2026/08/02/new.md", "New")];
  const current = `# Blog\n\n${BIO_START}\n\n${bio.markdown}\n\n${BIO_END}\n\n${POSTS_START}\n\n${formatReadmePostList(posts)}\n\n${POSTS_END}\n`;
  assert.equal(generateReadme(current, bio, posts), current);
});

test("README metadata changes for an H1 edit but not a body-only edit", () => {
  const sourcePath = "2026/08/02/post.md";
  const fromContent = (content: string) => [
    parsePostPath(sourcePath, extractPostTitle(content, sourcePath)),
  ];
  const template = `# Blog\n\n${BIO_START}\n\n${bio.markdown}\n\n${BIO_END}\n\n${POSTS_START}\n\n${POSTS_END}\n`;
  const original = generateReadme(template, bio, fromContent("# Original title\n\nFirst body."));
  const bodyEdit = generateReadme(template, bio, fromContent("# Original title\n\nChanged body."));
  const titleEdit = generateReadme(template, bio, fromContent("# Changed title\n\nFirst body."));

  assert.equal(bodyEdit, original);
  assert.notEqual(titleEdit, original);
});

test("rejects missing, duplicate, and reversed README markers", () => {
  assert.throws(() => generateReadme("# Blog\n", bio, []), /exactly one/);
  assert.throws(
    () => generateReadme(`${POSTS_START}\n${POSTS_START}\n${POSTS_END}\n`, bio, []),
    /found 2 start and 1 end/,
  );
  assert.throws(
    () => generateReadme(`${POSTS_END}\n${POSTS_START}\n`, bio, []),
    /markers are reversed/,
  );
});

test("collectPosts reports every invalid Markdown path below year directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-posts-"));
  try {
    await mkdir(path.join(root, "2026", "08", "02", "nested"), { recursive: true });
    await writeFile(path.join(root, "2026", "08", "02", "Good.md"), "# Good\n");
    await writeFile(path.join(root, "2026", "08", "02", "nested", "bad_name.md"), "Body\n");

    await assert.rejects(
      collectPosts(root),
      (error: unknown) => {
        if (!(error instanceof PostValidationError)) return false;
        assert.equal(error.issues.length, 2);
        assert.match(error.message, /2026\/08\/02\/Good\.md/);
        assert.match(error.message, /2026\/08\/02\/nested\/bad_name\.md/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("collectPosts discovers canonical and variant files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-posts-"));
  try {
    const directory = path.join(root, "2026", "08", "02");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "arc-raiders.md"), "# English title\n");
    await writeFile(path.join(directory, "arc-raiders_hu.md"), "# Magyar cím\n");

    const posts = await collectPosts(root);
    assert.deepEqual(posts.map((item) => item.slug), ["arc-raiders", "arc-raiders_hu"]);
    assert.equal(groupPosts(posts)[0]!.variants[0]!.variant, "hu");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("collectPosts rejects an orphaned variant file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-posts-"));
  try {
    const directory = path.join(root, "2026", "08", "02");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "arc-raiders_hu.md"), "# Magyar cím\n");

    await assert.rejects(collectPosts(root), /requires canonical post/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
