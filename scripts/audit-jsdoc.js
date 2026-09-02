/**
 * Audits source and test file headers with TypeScript's compiler API.
 */

import { basename } from "node:path";
import ts from "typescript";
import { Glob } from "bun";

const failures = [];
const sourceFiles = [
  ...new Glob("src/**/*.{ts,tsx}").scanSync("."),
  ...new Glob("tests/**/*.js").scanSync("."),
].sort();

for (const file of sourceFiles) {
  const source = await Bun.file(file).text();
  const range = ts.getLeadingCommentRanges(source, 0)?.[0];
  const header = range ? source.slice(range.pos, range.end) : "";
  if (!header.startsWith("/**"))
    failures.push(`${file}: missing file-level JSDoc`);
  if (!header.includes(`@file ${basename(file)}`))
    failures.push(`${file}: incorrect @file tag`);
  if (!/@description\s+\S.+/u.test(header))
    failures.push(`${file}: missing meaningful @description`);
  if (!header.includes("@author Gurkirat Singh"))
    failures.push(`${file}: missing @author Gurkirat Singh`);
  if (!header.includes("@license MIT"))
    failures.push(`${file}: missing @license MIT`);
  if (/implementation for Hmmmidea|invoked collaborators own/u.test(source)) {
    failures.push(`${file}: contains generated documentation filler`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `JSDoc header audit passed for ${sourceFiles.length} source and test files.`,
);
