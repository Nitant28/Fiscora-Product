import fs from "fs";
import path from "path";

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      walk(file);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes("proxyAuth")) continue;
    const next = content.replace(
      /from ["'][./]+lib\/proxyAuth["']/g,
      'from "@/lib/proxyAuth"'
    );
    if (next !== content) {
      fs.writeFileSync(file, next);
      console.log("fixed", file);
    }
  }
}

walk("app/api/proxy");
