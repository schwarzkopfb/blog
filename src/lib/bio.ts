import { readFile } from "node:fs/promises";
import path from "node:path";
import { BIO_END, BIO_START, POSTS_END, POSTS_START } from "./markers";

export type Bio = {
  markdown: string;
};

export class BioValidationError extends Error {
  constructor(rule: string) {
    super([
      "Invalid BIO.md",
      "",
      "BIO.md is embedded into both README.md and the website index.",
      "It must be a non-empty Markdown fragment without frontmatter or an H1 heading.",
      "",
      rule,
    ].join("\n"));
    this.name = "BioValidationError";
  }
}

function normalizeBioMarkdown(content: string): string {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  return lines.join("\n");
}

export function validateBio(content: string): Bio {
  const markdown = normalizeBioMarkdown(content);
  if (markdown.trim() === "") {
    throw new BioValidationError("BIO.md must not be empty or whitespace-only.");
  }

  const firstLine = markdown.split("\n", 1)[0]!;
  if (firstLine.trim() === "---") {
    throw new BioValidationError("YAML frontmatter is not allowed; begin with the introduction paragraph.");
  }
  if (firstLine.trim() === "+++") {
    throw new BioValidationError("TOML frontmatter is not allowed; begin with the introduction paragraph.");
  }
  if (/^ {0,3}#(?:[ \t]|$)/.test(firstLine)) {
    throw new BioValidationError("BIO.md must not start with an H1 heading; no About heading is required.");
  }

  for (const marker of [BIO_START, BIO_END, POSTS_START, POSTS_END]) {
    if (markdown.includes(marker)) {
      throw new BioValidationError(`Generator marker ${marker} is not allowed inside BIO.md.`);
    }
  }

  for (const match of markdown.matchAll(/(?<!!)\[[^\]\n]+\]\(\s*([^\s)]+)/g)) {
    const target = match[1]!;
    if (!/^https?:\/\//i.test(target)) {
      throw new BioValidationError(
        `Profile links must use absolute HTTP or HTTPS URLs; received ${target}.`,
      );
    }
  }

  return { markdown };
}

export async function readBio(root = process.cwd()): Promise<Bio> {
  const bioPath = path.join(root, "BIO.md");
  try {
    const bytes = await readFile(bioPath);
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return validateBio(content);
  } catch (error) {
    if (error instanceof BioValidationError) throw error;
    throw new BioValidationError(
      `BIO.md must exist and be readable as UTF-8 text. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
