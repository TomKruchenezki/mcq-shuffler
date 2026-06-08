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

const FIXTURES = 'manual-fixtures'

if (!fs.existsSync(FIXTURES)) {
  console.log(`ℹ️  ${FIXTURES}/ does not exist — nothing to check`)
  process.exit(0)
}

try {
  const tracked = execSync(`git ls-files ${FIXTURES}/`, { encoding: 'utf8' }).trim()
  if (tracked) {
    console.error(`❌ ERROR: Real PDF fixtures are tracked by git!\n${tracked}`)
    console.error('\nRun: git rm --cached ' + FIXTURES + '/<file>')
    process.exit(1)
  }
  console.log(`✅ ${FIXTURES}/ is correctly ignored by git`)
} catch {
  console.log(`ℹ️  Could not verify git tracking (not in a git repo?)`)
}
