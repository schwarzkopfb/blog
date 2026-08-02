import type { Bio } from "./bio";
import { BIO_END, BIO_START, POSTS_END, POSTS_START } from "./markers";
import type { Post } from "./posts";

export { BIO_END, BIO_START, POSTS_END, POSTS_START } from "./markers";

type MarkerRange = {
  start: number;
  end: number;
};

export function escapeMarkdownLinkLabel(title: string): string {
  return title.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}

export function formatReadmePostList(posts: Post[]): string {
  return posts
    .map(
      (post) =>
        `- \`${post.date}\` [${escapeMarkdownLinkLabel(post.title)}](./${post.sourcePath})`,
    )
    .join("\n");
}

function markerPositions(content: string, marker: string): number[] {
  const positions: number[] = [];
  let position = content.indexOf(marker);
  while (position !== -1) {
    positions.push(position);
    position = content.indexOf(marker, position + marker.length);
  }
  return positions;
}

function markerRange(
  content: string,
  label: string,
  startMarker: string,
  endMarker: string,
): MarkerRange {
  const starts = markerPositions(content, startMarker);
  const ends = markerPositions(content, endMarker);

  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(
      `README.md must contain exactly one ${startMarker} marker and exactly one ${endMarker} marker; found ${starts.length} start and ${ends.length} end markers for the ${label} section.`,
    );
  }

  const start = starts[0]!;
  const end = ends[0]!;
  if (start >= end) {
    throw new Error(
      `README.md ${label} markers are reversed; ${startMarker} must appear before ${endMarker}.`,
    );
  }

  return { start, end: end + endMarker.length };
}

function addMissingBioBlock(content: string): string {
  const starts = markerPositions(content, BIO_START);
  const ends = markerPositions(content, BIO_END);
  if (starts.length === 0 && ends.length === 0) {
    const posts = markerRange(content, "posts", POSTS_START, POSTS_END);
    const prefix = content.slice(0, posts.start);
    const suffix = content.slice(posts.start);
    const separator = prefix.endsWith("\n\n") || prefix.length === 0
      ? ""
      : prefix.endsWith("\n") ? "\n" : "\n\n";
    return `${prefix}${separator}${BIO_START}\n\n${BIO_END}\n\n${suffix}`;
  }

  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(
      `README.md bio markers are malformed; found ${starts.length} ${BIO_START} and ${ends.length} ${BIO_END} markers. Both must appear exactly once.`,
    );
  }

  return content;
}

function replaceGeneratedSection(
  content: string,
  label: string,
  startMarker: string,
  endMarker: string,
  generated: string,
): string {
  const range = markerRange(content, label, startMarker, endMarker);
  const prefix = content.slice(0, range.start + startMarker.length);
  const suffix = content.slice(range.end - endMarker.length);
  return `${prefix}\n\n${generated}\n\n${suffix}`;
}

export function generateReadme(currentReadme: string, bio: Bio, posts: Post[]): string {
  let generated = addMissingBioBlock(currentReadme.replace(/\r\n?/g, "\n"));
  const bioRange = markerRange(generated, "bio", BIO_START, BIO_END);
  const postsRange = markerRange(generated, "posts", POSTS_START, POSTS_END);
  const overlaps = bioRange.start < postsRange.end && postsRange.start < bioRange.end;

  if (overlaps) {
    throw new Error("README.md bio and posts generated sections overlap; each marker block must be independent.");
  }
  if (bioRange.start > postsRange.start) {
    throw new Error(`README.md bio section must appear before the ${POSTS_START} post section.`);
  }

  generated = replaceGeneratedSection(generated, "bio", BIO_START, BIO_END, bio.markdown);
  generated = replaceGeneratedSection(
    generated,
    "posts",
    POSTS_START,
    POSTS_END,
    formatReadmePostList(posts),
  );
  return generated.replace(/\n*$/, "\n");
}
