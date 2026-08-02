# Repository rules

- Posts live at root-level `YYYY/MM/DD/<kebab-slug>.md`; keep post assets beside them. Optional variants use `YYYY/MM/DD/<kebab-slug>_<postfix>.md` and require the unsuffixed canonical post.
- Every post starts on line 1 with `# <plain-text title>`. No frontmatter. The path supplies date, slug, and route; the H1 supplies the title.
- `src/lib/posts.ts` is the single source for post discovery, validation, metadata derivation, and newest-first sorting.
- `BIO.md` is the single source for the introduction and profile links. Keep it as a small Markdown fragment without frontmatter or an H1; Astro renders it directly.
- The root website index and generated README use shared source content. They list canonical posts once and add links for any variants. Never parse README as site data.
- Do not hand-edit the `<!-- bio:start -->` or `<!-- posts:start -->` generated sections; edit `BIO.md` or posts, then run `npm run generate:readme`. CI synchronizes README for GitHub.com edits.
- Public post routes mirror each filename at `/<YYYY>/<MM>/<DD>/<slug>[_<postfix>]` with no `.md` or `.html`.
- Astro is static-only for GitHub Pages. Preserve co-located relative images and trusted raw HTML/YouTube embeds.
- UI stays minimal and editorial: `schwarzkopfb/blog`, post-page `All posts`, a muted uppercase path label, large serif H1, a static variant switcher when alternatives exist, simple date/title index, and canonical-only chronological previous/next post links.
- Do not add frontmatter, a client framework, Tailwind, CMS, database, sidebar, search, tags, comments, pagination, RSS, analytics, or client JavaScript without an explicit request.
- CI must build successfully before committing generated README changes and must deploy the already-built artifact in the same workflow run.
- Use Node 24 and npm; commit `package-lock.json` and use `npm ci` in CI.
- Before finishing, run `npm test`, `npm run check`, and `npm run build`.
