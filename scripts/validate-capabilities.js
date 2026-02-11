#!/usr/bin/env node
/**
 * Validates Tauri capability JSON files against ACL identifier rules.
 * Run with: node scripts/validate-capabilities.js
 * Used in CI or pre-commit to catch invalid identifiers before cargo build.
 *
 * Rules (from Tauri):
 * - Lowercase ASCII letters [a-z] and hyphens [-]
 * - At most one colon [:] (for plugin prefix)
 * - No leading or trailing hyphen
 * - No underscores
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPABILITIES_DIR = path.join(__dirname, "..", "src-tauri", "capabilities");

// Tauri ACL: lowercase ASCII, hyphens, single colon for prefix only

function validateIdentifier(id, location) {
  if (typeof id !== "string") {
    return { ok: false, message: `${location}: identifier must be a string` };
  }
  if (id.startsWith("-") || id.endsWith("-")) {
    return { ok: false, message: `${location}: identifier cannot have leading or trailing hyphen` };
  }
  if (id.includes("_")) {
    return { ok: false, message: `${location}: identifier cannot contain underscore (use hyphen)` };
  }
  const parts = id.split(":");
  if (parts.length > 2) {
    return { ok: false, message: `${location}: at most one colon allowed` };
  }
  for (const part of parts) {
    if (!/^[a-z][a-z-]*$/.test(part)) {
      return {
        ok: false,
        message: `${location}: each part must be lowercase ASCII letters and hyphens only (no digits, no leading/trailing hyphen)`,
      };
    }
  }
  return { ok: true };
}

function validateCapabilityFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return [{ ok: false, message: `Invalid JSON: ${e.message}` }];
  }

  const errors = [];
  const one = Array.isArray(data) ? data[0] : data.capabilities?.[0] ?? data;

  if (one.identifier) {
    const r = validateIdentifier(one.identifier, "capability.identifier");
    if (!r.ok) errors.push(r);
  }
  const perms = one.permissions ?? [];
  for (let i = 0; i < perms.length; i++) {
    const p = perms[i];
    const id = typeof p === "string" ? p : p.identifier;
    if (id !== undefined) {
      const r = validateIdentifier(id, `permissions[${i}]`);
      if (!r.ok) errors.push(r);
    }
  }
  return errors;
}

function main() {
  const files = fs.readdirSync(CAPABILITIES_DIR).filter((f) => f.endsWith(".json"));
  let hadError = false;
  for (const file of files) {
    const filePath = path.join(CAPABILITIES_DIR, file);
    const errors = validateCapabilityFile(filePath);
    if (errors.length > 0) {
      hadError = true;
      console.error(`\n${file}:`);
      errors.forEach((e) => console.error("  ", e.message));
    }
  }
  if (hadError) {
    console.error("\nCapability validation failed. Fix identifiers (lowercase, hyphens only, no leading/trailing hyphen).\n");
    process.exit(1);
  }
  console.log("Capability files OK.");
}

main();
