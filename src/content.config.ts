import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({
    base: ".",
    pattern: "[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/*.md",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
});

export const collections = { posts };
