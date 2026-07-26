'use strict'

/**
 * Test entry point.
 *
 * `node --test test/` cannot be used: from Node 22 a positional argument is
 * treated as a glob pattern rather than a directory to walk, so a bare
 * directory resolves as a module path and the run dies with MODULE_NOT_FOUND.
 * Passing a glob instead fails the other way round, because Node 18 and 20 take
 * it literally.
 *
 * Reading the directory here works identically on every supported version and
 * on every platform, and it still discovers new test files by itself, so a test
 * that someone adds can never silently fail to run.
 */

const { readdirSync } = require('fs')
const { spawnSync } = require('child_process')
const path = require('path')

const files = readdirSync(__dirname)
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => path.join(__dirname, name))

if (files.length === 0) {
  console.error('no test files found in ' + __dirname)
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status === null ? 1 : result.status)
