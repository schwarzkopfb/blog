import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type Post = {
  sourcePath: string;
  id: string;
  route: string;
  date: string;
  year: string;
  month: string;
  day: string;
  slug: string;
  baseSlug: string;
  variant: string | null;
  canonicalId: string;
  title: string;
  pathLabel: string;
};

export type PostGroup = {
  canonical: Post;
  variants: Post[];
};

export type PostNeighbors = {
  previous: Post | null;
  next: Post | null;
};

export class PostValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n\n"));
    this.name = "PostValidationError";
    this.issues = issues;
  }
}

const POST_PATH = /^(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:_([a-z0-9]+(?:-[a-z0-9]+)*))?\.md$/;
const EXPECTED_PATH = "YYYY/MM/DD/lowercase-kebab-case[_variant].md";

export function normalizeSourcePath(sourcePath: string): string {
  return sourcePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function pathError(sourcePath: string, detail?: string): PostValidationError {
  const normalized = normalizeSourcePath(sourcePath);
  return new PostValidationError([
    [
      `Invalid blog post path: ${normalized}`,
      "",
      detail ??
        "Post paths must use a real date, a lowercase kebab-case slug, and at most one optional variant postfix.",
      "",
      `Expected: ${EXPECTED_PATH}`,
      `Received: ${normalized}`,
    ].join("\n"),
  ]);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parsePostPath(sourcePath: string, title: string): Post {
  const normalized = normalizeSourcePath(sourcePath);
  const match = POST_PATH.exec(normalized);

  if (!match) {
    throw pathError(sourcePath);
  }

  const year = match[1]!;
  const month = match[2]!;
  const day = match[3]!;
  const baseSlug = match[4]!;
  const variant = match[5] ?? null;
  const slug = variant ? `${baseSlug}_${variant}` : baseSlug;
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericYear = Number(year);

  if (numericYear === 0) {
    throw pathError(sourcePath, "Year must represent a real civil year; received 0000.");
  }

  if (numericMonth < 1 || numericMonth > 12) {
    throw pathError(sourcePath, `Month must be between 01 and 12; received ${month}.`);
  }

  const maximumDay = daysInMonth(numericYear, numericMonth);
  if (numericDay < 1 || numericDay > maximumDay) {
    throw pathError(
      sourcePath,
      `Day ${day} does not exist in ${year}-${month}; expected 01 through ${String(maximumDay).padStart(2, "0")}.`,
    );
  }

  const id = normalized.slice(0, -3);
  const canonicalId = `${year}/${month}/${day}/${baseSlug}`;
  return {
    sourcePath: normalized,
    id,
    route: `/${id}`,
    date: `${year}-${month}-${day}`,
    year,
    month,
    day,
    slug,
    baseSlug,
    variant,
    canonicalId,
    title,
    pathLabel: `${year} / ${month} / ${day} / ${slug.toUpperCase()}`,
  };
}

export function extractPostTitle(content: string, sourcePath = "<content>"): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const match = /^# (.+)$/.exec(firstLine);
  const title = match?.[1];

  if (!title || title.trim().length === 0) {
    const received = firstLine.length > 0 ? firstLine : "(empty line)";
    throw new PostValidationError([
      [
        `Invalid blog post: ${normalizeSourcePath(sourcePath)}`,
        "",
        "Every post must begin on line 1 with a non-empty H1:",
        "",
        "  # Post title",
        "",
        "Received:",
        "",
        `  ${received}`,
      ].join("\n"),
    ]);
  }

  return title.trim();
}

export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? 1 : -1;
    if (left.slug === right.slug) return 0;
    return left.slug < right.slug ? -1 : 1;
  });
}

export function groupPosts(posts: Post[]): PostGroup[] {
  const sortedPosts = sortPosts(posts);
  const canonicalPosts = sortedPosts.filter((post) => post.variant === null);
  const canonicalIds = new Set(canonicalPosts.map((post) => post.id));
  const orphanedVariants = sortedPosts.filter(
    (post) => post.variant !== null && !canonicalIds.has(post.canonicalId),
  );

  if (orphanedVariants.length > 0) {
    throw new PostValidationError(
      orphanedVariants.map(
        (post) =>
          `Variant post ${post.sourcePath} requires canonical post ${post.canonicalId}.md.`,
      ),
    );
  }

  return canonicalPosts.map((canonical) => ({
    canonical,
    variants: sortedPosts
      .filter((post) => post.canonicalId === canonical.id && post.variant !== null)
      .sort((left, right) => left.variant!.localeCompare(right.variant!, "en")),
  }));
}

export function getPostNeighbors(posts: Post[], currentId: string): PostNeighbors {
  const index = posts.findIndex((post) => post.id === currentId);
  if (index === -1) {
    throw new Error(`Cannot derive post navigation: ${currentId} is not in the collected post list.`);
  }

  return {
    previous: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
  };
}

async function discoverCandidatePaths(root: string): Promise<string[]> {
  const candidates: string[] = [];
  const rootEntries = await readdir(root, { withFileTypes: true });
  const yearDirectories = rootEntries.filter(
    (entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name),
  );

  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const relativePath = normalizeSourcePath(path.join(relativeDirectory, entry.name));
        const absolutePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          await walk(absolutePath, relativePath);
        } else if (entry.isFile() && /\.(?:md|markdown)$/i.test(entry.name)) {
          candidates.push(relativePath);
        }
      }),
    );
  }

  await Promise.all(
    yearDirectories.map((entry) => walk(path.join(root, entry.name), entry.name)),
  );
  return candidates.sort();
}

export async function collectPosts(root = process.cwd()): Promise<Post[]> {
  const candidates = await discoverCandidatePaths(root);
  const posts: Post[] = [];
  const issues: string[] = [];

  for (const sourcePath of candidates) {
    try {
      const content = await readFile(path.join(root, ...sourcePath.split("/")), "utf8");
      const title = extractPostTitle(content, sourcePath);
      posts.push(parsePostPath(sourcePath, title));
    } catch (error) {
      if (error instanceof PostValidationError) {
        issues.push(...error.issues);
      } else {
        issues.push(`Unable to read blog post ${sourcePath}: ${String(error)}`);
      }
    }
  }

  if (issues.length > 0) {
    throw new PostValidationError(issues);
  }

  const sortedPosts = sortPosts(posts);
  groupPosts(sortedPosts);
  return sortedPosts;
}
