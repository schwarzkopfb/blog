import { readBio } from "../src/lib/bio";

try {
  await readBio();
  console.log("Validated BIO.md.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
