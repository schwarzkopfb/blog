import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BioValidationError, readBio, validateBio } from "../src/lib/bio";
import {
  BIO_END,
  BIO_START,
  formatReadmePostList,
  generateReadme,
  POSTS_END,
  POSTS_START,
} from "../src/lib/readme";
import { parsePostPath } from "../src/lib/posts";

const validMarkdown = [
  "I write code, make music, and cook. I never follow the recipe exactly.",
  "",
  "[GitHub](https://github.com/schwarzkopfb) · [LinkedIn](https://www.linkedin.com/in/schwarzkopfb)",
].join("\n");

const post = parsePostPath("2026/08/02/post.md", "Post title");

function readmeTemplate(bioMarkdown = "Old bio", posts = "Old posts"): string {
  return [
    "# Blog",
    "",
    BIO_START,
    "",
    bioMarkdown,
    "",
    BIO_END,
    "",
    POSTS_START,
    "",
    posts,
    "",
    POSTS_END,
    "",
  ].join("\n");
}

test("accepts a valid BIO.md paragraph and absolute profile links", () => {
  assert.deepEqual(validateBio(validMarkdown), { markdown: validMarkdown });
});

test("rejects empty and whitespace-only BIO.md content", () => {
  assert.throws(() => validateBio(""), /must not be empty/);
  assert.throws(() => validateBio(" \n\t\n"), /whitespace-only/);
});

test("rejects YAML and TOML frontmatter at the beginning", () => {
  assert.throws(() => validateBio("---\ntitle: Bio\n---\nText"), /YAML frontmatter/);
  assert.throws(() => validateBio("+++\ntitle = 'Bio'\n+++\nText"), /TOML frontmatter/);
});

test("rejects an H1 as the first meaningful line", () => {
  assert.throws(() => validateBio("\n\n# About\n\nText"), /must not start with an H1/);
});

test("preserves Unicode content and paragraph spacing", () => {
  const markdown = "Balázs ír kódot.\n\nMásodik bekezdés – pontosan így.";
  assert.equal(validateBio(markdown).markdown, markdown);
});

test("normalizes line endings and removes only outer blank lines", () => {
  const markdown = "\r\n  \r\nFirst paragraph.\r\n\r\nSecond paragraph.\r\n\r\n";
  assert.equal(validateBio(markdown).markdown, "First paragraph.\n\nSecond paragraph.");
});

test("rejects README generator markers inside BIO.md", () => {
  assert.throws(() => validateBio(`Text\n${BIO_START}`), /bio:start/);
  assert.throws(() => validateBio(`Text\n${BIO_END}`), /bio:end/);
  assert.throws(() => validateBio(`Text\n${POSTS_START}`), /posts:start/);
});

test("rejects relative profile links", () => {
  assert.throws(() => validateBio("Text.\n\n[Profile](/profile)"), /absolute HTTP or HTTPS/);
});

test("readBio reads the root BIO.md as UTF-8", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-bio-"));
  try {
    await writeFile(path.join(root, "BIO.md"), `${validMarkdown}\n`, "utf8");
    assert.deepEqual(await readBio(root), { markdown: validMarkdown });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readBio reports a missing BIO.md actionably", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blog-bio-missing-"));
  try {
    await assert.rejects(readBio(root), (error: unknown) => {
      assert.ok(error instanceof BioValidationError);
      assert.match(error.message, /must exist and be readable as UTF-8/);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generates independent bio and post README blocks", () => {
  const bio = validateBio(validMarkdown);
  const generated = generateReadme(readmeTemplate(), bio, [post]);
  assert.match(generated, new RegExp(`${BIO_START}[\\s\\S]*${BIO_END}`));
  assert.match(generated, new RegExp(`${POSTS_START}[\\s\\S]*${POSTS_END}`));
  assert.ok(generated.indexOf(BIO_START) < generated.indexOf(POSTS_START));
  assert.match(generated, /https:\/\/github\.com\/schwarzkopfb/);
  assert.match(generated, /\.\/2026\/08\/02\/post\.md/);
});

test("preserves README content outside both generated blocks", () => {
  const current = `Manual intro.\n\n${readmeTemplate()}Manual footer.\n`;
  const generated = generateReadme(current, validateBio(validMarkdown), [post]);
  assert.ok(generated.startsWith("Manual intro.\n\n# Blog"));
  assert.ok(generated.endsWith(`${POSTS_END}\nManual footer.\n`));
});

test("leaves an already-current two-section README unchanged", () => {
  const bio = validateBio(validMarkdown);
  const current = readmeTemplate(bio.markdown, formatReadmePostList([post]));
  assert.equal(generateReadme(current, bio, [post]), current);
});

test("adds missing bio markers above an existing post block", () => {
  const current = `# Blog\n\n${POSTS_START}\n\nOld\n\n${POSTS_END}\n`;
  const generated = generateReadme(current, validateBio(validMarkdown), [post]);
  assert.ok(generated.indexOf(BIO_START) < generated.indexOf(POSTS_START));
  assert.match(generated, new RegExp(`${BIO_START}\\n\\n${validMarkdown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("rejects incomplete, duplicate, and reversed bio markers", () => {
  const posts = `${POSTS_START}\n\n${POSTS_END}`;
  assert.throws(
    () => generateReadme(`${BIO_START}\n${posts}`, validateBio(validMarkdown), []),
    /bio markers are malformed/,
  );
  assert.throws(
    () => generateReadme(`${BIO_START}\n${BIO_START}\n${BIO_END}\n${posts}`, validateBio(validMarkdown), []),
    /found 2/,
  );
  assert.throws(
    () => generateReadme(`${BIO_END}\n${BIO_START}\n${posts}`, validateBio(validMarkdown), []),
    /bio markers are reversed/,
  );
});

test("rejects overlapping generated sections", () => {
  const current = `${BIO_START}\n${POSTS_START}\n${BIO_END}\n${POSTS_END}\n`;
  assert.throws(
    () => generateReadme(current, validateBio(validMarkdown), []),
    /generated sections overlap/,
  );
});

test("changing BIO.md changes README output", () => {
  const current = readmeTemplate();
  const first = generateReadme(current, validateBio("First bio."), [post]);
  const second = generateReadme(current, validateBio("Changed bio."), [post]);
  assert.notEqual(first, second);
});

test("a post body-only edit changes neither generated README block", () => {
  const bio = validateBio(validMarkdown);
  const fromContent = (content: string) => {
    const title = content.split("\n", 1)[0]!.slice(2);
    return [parsePostPath("2026/08/02/post.md", title)];
  };
  const current = readmeTemplate();
  const first = generateReadme(current, bio, fromContent("# Same title\n\nFirst body."));
  const second = generateReadme(current, bio, fromContent("# Same title\n\nChanged body."));
  assert.equal(first, second);
});
