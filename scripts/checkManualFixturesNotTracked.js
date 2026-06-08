#!/usr/bin/env node
'use strict'
/**
 * scripts/checkManualFixturesNotTracked.js
 *
 * Safety check: verifies that no files under manual-fixtures/ are tracked by git.
 * Real exam PDFs must never be committed.
 *
 * Usage: npm run check:fixtures
 */
const { execSync } = require('child_process')
const fs = require('fs')

// Check both the root fixture dir and the pdf/ subdirectory
const FIXTURE_DIRS = ['manual-fixtures', 'manual-fixtures/pdf']

let anyTracked = false

for (const dir of FIXTURE_DIRS) {
  if (!fs.existsSync(dir)) continue
  try {
    const tracked = execSync(`git ls-files ${dir}/`, { encoding: 'utf8' }).trim()
    if (tracked) {
      console.error(`❌ ERROR: Real PDF fixtures are tracked by git!\n${tracked}`)
      console.error('\nRun: git rm --cached <file>')
      anyTracked = true
    }
  } catch {
    console.log(`ℹ️  Could not verify git tracking for ${dir}/ (not in a git repo?)`)
  }
}

if (anyTracked) {
  process.exit(1)
} else {
  console.log('✅ No manual PDF fixtures are tracked by git')
}
