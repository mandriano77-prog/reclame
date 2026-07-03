#!/usr/bin/env node
'use strict';

/**
 * Blocca commit/lavoro che tocca Filo Diretto su branch Reclame.
 *
 * Uso:
 *   npm run check:reclame-scope
 *   RECLAME_SCOPE=staged npm run check:reclame-scope   # solo file in stage (pre-commit)
 *   RECLAME_SCOPE_BASE=origin/main npm run check:reclame-scope  # diff vs main (tre punti)
 *   RECLAME_SCOPE=range RECLAME_SCOPE_FROM=<sha> RECLAME_SCOPE_TO=<sha>  # CI push
 *
 * Bypass (solo manuale): ALLOW_FILO_EDITS=1
 */

const { execSync } = require('child_process');

const FORBIDDEN_PATTERNS = [
  /^src\/filodiretto\//,
  /^scripts\/build-fd-bundles\.js$/,
  /^e2e\/fd-/,
  /^scripts\/fd-/,
  /^scripts\/hub-pga-/,
];

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function listChangedFiles() {
  const mode = String(process.env.RECLAME_SCOPE || 'working').toLowerCase();
  const base = process.env.RECLAME_SCOPE_BASE;

  if (mode === 'staged') {
    return sh('git diff --cached --name-only').split('\n').filter(Boolean);
  }

  if (mode === 'range') {
    const from = process.env.RECLAME_SCOPE_FROM;
    const to = process.env.RECLAME_SCOPE_TO || 'HEAD';
    if (!from) {
      throw new Error('RECLAME_SCOPE=range richiede RECLAME_SCOPE_FROM');
    }
    if (from === to) return [];
    return sh(`git diff --name-only ${from} ${to}`).split('\n').filter(Boolean);
  }

  if (base) {
    return sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean);
  }

  const staged = sh('git diff --cached --name-only').split('\n').filter(Boolean);
  const unstaged = sh('git diff --name-only').split('\n').filter(Boolean);
  const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
  return [...new Set([...staged, ...unstaged, ...untracked])];
}

function isForbidden(filePath) {
  return FORBIDDEN_PATTERNS.some((re) => re.test(filePath));
}

function main() {
  if (process.env.ALLOW_FILO_EDITS === '1') {
    console.log('assert-reclame-scope: ALLOW_FILO_EDITS=1 — skip');
    process.exit(0);
  }

  let files;
  try {
    sh('git rev-parse --git-dir');
    files = listChangedFiles();
  } catch (err) {
    console.error('assert-reclame-scope: git non disponibile o non in un repo');
    process.exit(1);
  }

  const blocked = files.filter(isForbidden);
  if (!blocked.length) {
    console.log(`assert-reclame-scope: ok (${files.length} file controllati)`);
    process.exit(0);
  }

  console.error('\nassert-reclame-scope: modifiche in zona Filo Diretto / HR non consentite su Reclame.\n');
  blocked.forEach((f) => console.error(`  - ${f}`));
  console.error('\nRegole: .cursor/rules/reclame-only.mdc');
  console.error('Bypass emergenza: ALLOW_FILO_EDITS=1 npm run check:reclame-scope\n');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { FORBIDDEN_PATTERNS, isForbidden, listChangedFiles };
