import { copyFile } from "node:fs/promises";
import { defineConfig } from "astro/config";

const rootCname = {
  name: "root-cname",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await copyFile(new URL("./CNAME", import.meta.url), new URL("CNAME", dir));
    },
  },
};

export default defineConfig({
  output: "static",
  site: "https://abc.schwarzkopfb.xyz",
  base: "/",
  trailingSlash: "ignore",
  integrations: [rootCname],
  build: {
    format: "directory",
  },
});
