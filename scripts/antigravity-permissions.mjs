#!/usr/bin/env node
// Grants Antigravity CLI's headless mode the file reads the local tutor needs,
// plus the one shell command it uses to turn a slide deck into markdown.
//
// Why this file exists: `agy -p` (print/headless mode) has no terminal to answer
// a permission prompt, so a tool call the permission engine wants to ask about
// comes back as a denied_action and the turn ends with an empty response.
//
//   node scripts/antigravity-permissions.mjs            # add/refresh rules
//   node scripts/antigravity-permissions.mjs --check     # report only, no write
//   node scripts/antigravity-permissions.mjs --print     # dump resolved settings
//
// Existing rules are never removed — the file may hold rules the user added by
// hand (the installer writes a few for `node -v` etc.).

// Windows caveat, verified against agy 1.2.14 on this machine: headless runs
// soft-deny *every* command tool regardless of `permissions.allow` — even the
// broadest rule, `command(node)`. That is the old permission engine, which
// Windows still uses (the unified macOS/Linux one is not shipped here yet), and
// its print mode has no path from an allow-rule to an approval.
//
// So the app passes `--dangerously-skip-permissions` on Windows by default and
// these rules only decide what is *possible* elsewhere. Keep them: the read_file
// grants apply on every platform, and the command rules take effect on macOS and
// Linux. Set ANTIGRAVITY_STRICT_PERMISSIONS=1 to turn the flag off on purpose.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Only what the tutor is expected to touch.
 *
 * Rule shape: `command(prefix)` matches a literal token prefix,
 * `command(regex:pattern)` evaluates *each whitespace-separated token* as an
 * anchored `^(?:pattern)$`. A trailing ` .*` as its own token therefore matches
 * exactly one more token, not the rest of the line — which is why each pattern
 * below is a single whitespace-free expression using `\s+` and `.*`, so the whole
 * command line has to match `^(?:node\s+scripts\/extract-library-text\.mjs.*)$`.
 */
const REQUIRED_RULES = [
  // Search / read one slide deck or handout as markdown with page markers.
  // `--find`, `--toc`, `--from/--to`, `--max-chars` all go through this one rule.
  "command(regex:node\\s+scripts/extract-library-text\\.mjs.*)",
  // Same script, no arguments.
  "command(regex:node\\s+scripts/extract-library-text\\.mjs)",
  // Refresh the library manifest so the agent sees newly added documents.
  "command(regex:npm\\s+run\\s+index:library)",
  // The agent reads the skill, the manifest and the lesson text as plain files.
  // Workspace-relative paths, which is how agy resolves them from --add-dir.
  "read_file(ONLY_FOR_AI_TO_LEARN)",
  "read_file(data)",
  "read_file(.agents)",
];

const SETTINGS_PATH =
  process.env.ANTIGRAVITY_SETTINGS_PATH?.trim() ||
  path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");

async function readSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    // PowerShell 5.1 writes UTF-8 *with* a BOM; JSON.parse rejects it.
    const raw = (await readFile(SETTINGS_PATH, "utf8")).replace(/^﻿/, "");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Không đọc được ${SETTINGS_PATH}: ${error.message}\n` +
        "Sửa tay file JSON này rồi chạy lại, script không ghi đè file hỏng.",
    );
  }
}

function missingRules(allow) {
  return REQUIRED_RULES.filter((rule) => !allow.includes(rule));
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const settings = await readSettings();

  if (process.argv.includes("--print")) {
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  const permissions =
    settings.permissions && typeof settings.permissions === "object"
      ? settings.permissions
      : {};
  const allow = Array.isArray(permissions.allow) ? [...permissions.allow] : [];
  const missing = missingRules(allow);

  console.log(`settings: ${SETTINGS_PATH}`);
  if (missing.length === 0) {
    console.log(`Đã có đủ ${REQUIRED_RULES.length} rule cần thiết — không cần sửa.`);
    return;
  }
  for (const rule of missing) console.log(`  thiếu: ${rule}`);
  if (checkOnly) {
    console.log("\nChạy lại không có --check để thêm các rule trên.");
    return;
  }

  const next = {
    ...settings,
    permissions: { ...permissions, allow: [...allow, ...missing] },
  };
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`\nĐã thêm ${missing.length} rule. Áp dụng ngay ở phiên agy kế tiếp.`);
}

await main();