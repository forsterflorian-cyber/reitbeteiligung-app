import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".sql", ".css", ".scss", ".svg", ".yml", ".yaml", ".txt"]);
const ignoreDirs = new Set([".git", ".next", "node_modules", ".VSCodeCounter"]);
const suspiciousPattern = /(\u00C3.|\u00C2|\uFFFD)/u;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (textExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const failures = [];

for (const file of walk(root)) {
  const buffer = fs.readFileSync(file);
  const relativePath = path.relative(root, file).replaceAll("\\", "/");
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    failures.push(`${relativePath}: UTF-8 BOM gefunden`);
    continue;
  }
  const content = buffer.toString("utf8");
  const match = content.match(suspiciousPattern);
  if (match) {
    failures.push(`${relativePath}: verd?chtige Zeichenfolge "${match[0]}" gefunden`);
  }
}

if (failures.length > 0) {
  console.error("Encoding-Pr?fung fehlgeschlagen:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Encoding-Pr?fung erfolgreich. Keine BOMs oder Mojibake-Zeichenfolgen gefunden.");
