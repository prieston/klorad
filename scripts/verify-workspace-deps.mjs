#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const packagesDir = path.join(workspaceRoot, "packages");
const internalPrefix = "@klorad/";

function getPackageJson(pkgPath) {
  return JSON.parse(fs.readFileSync(path.join(pkgPath, "package.json"), "utf8"));
}

// Recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (file !== "node_modules" && file !== "dist" && file !== ".next") {
        findTsFiles(filePath, fileList);
      }
    } else if (file.match(/\.(ts|tsx)$/)) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

let errors = [];

for (const pkg of fs.readdirSync(packagesDir)) {
  const pkgPath = path.join(packagesDir, pkg);

  // Skip if not a directory
  if (!fs.statSync(pkgPath).isDirectory()) {
    continue;
  }

  const srcPath = path.join(pkgPath, "src");
  if (!fs.existsSync(srcPath)) {
    continue;
  }

  const pkgJson = getPackageJson(pkgPath);

  const deps = {
    ...pkgJson.dependencies,
    ...pkgJson.peerDependencies,
    ...pkgJson.devDependencies,
  };

  const sourceFiles = findTsFiles(srcPath);
  const imports = new Set();

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    // Remove comments to avoid false positives
    const contentWithoutComments = content
      .replace(/\/\/.*$/gm, "") // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments
    // Match both 'from "@klorad/..."' and 'from '@klorad/...'
    // Strip subpath imports (e.g. "@klorad/config/workbench" -> "@klorad/config")
    // so the dep check matches the package name as declared in package.json.
    for (const match of contentWithoutComments.matchAll(/from ["']@klorad\/([^"'/]+)(?:\/[^"']*)?["']/g)) {
      imports.add(`@klorad/${match[1]}`);
    }
  }

  for (const imp of imports) {
    if (!deps?.[imp]) {
      errors.push(
        `❌ ${pkgJson.name} imports ${imp} but does not declare it in peerDependencies/devDependencies`
      );
    }
  }
}

if (errors.length) {
  console.log("\n================= WORKSPACE DEPENDENCY REPORT =================\n");
  for (const err of errors) console.log(err);
  console.log("\n🔥 Fix: add missing packages to peerDependencies and devDependencies.\n");
  process.exit(1);
}

console.log("✅ All workspace internal dependencies are correctly declared.");
process.exit(0);

