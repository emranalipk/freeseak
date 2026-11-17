/**
 * Rule-1 guard — the two pdf.js static workers in public/ must be exactly
 * the files of the installed pdfjs-dist version (pdf.js throws on
 * API/worker mismatch, and a caret-range upgrade that forgets to refresh
 * the statics would break every render tool at runtime). Byte-identity
 * against node_modules is the only version check that cannot lie, so this
 * compares hashes. Runs as `prebuild` (npm run build → automatic).
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";

const FILES = ["pdf.worker.min.mjs", "pdf.renderer.min.mjs"];

let failed = false;
for (const file of FILES) {
  const publicPath = new URL(`../public/${file}`, import.meta.url);
  const modulesPath = new URL(`../node_modules/pdfjs-dist/build/${file}`, import.meta.url);
  try {
    const a = createHash("sha256").update(readFileSync(publicPath)).digest("hex");
    const b = createHash("sha256").update(readFileSync(modulesPath)).digest("hex");
    if (a === b) {
      console.log(`✓ public/${file} matches the installed pdfjs-dist build`);
    } else {
      console.error(
        `✗ public/${file} differs from node_modules/pdfjs-dist/build/${file}.\n` +
          `  Copy the current build files into public/ before building.`,
      );
      failed = true;
    }
  } catch (err) {
    console.error(`✗ Could not read ${file}: ${err.message}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
