#!/usr/bin/env node
'use strict'

// Release-consistency checks shared by CI, the publish workflow, and tests.
// Usage: node scripts/verify-package.js [--tag vX.Y.Z]

const fs = require('fs')
const path = require('path')

const REPOSITORY = 'https://github.com/OpenFairWind/signalk-to-stalk'
const FORBIDDEN_PACKAGE_ENTRIES = ['test', 'test/', '.github', '.github/', '.idea', '.idea/', 'scripts', 'scripts/', 'node_modules', '.env']

function pngSize(buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return undefined
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function verifyPackage(root = path.join(__dirname, '..'), options = {}) {
  const problems = []
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

  if (pkg.name !== 'signalk-to-stalk') problems.push(`package name must be signalk-to-stalk, found ${pkg.name}`)
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pkg.version || '')) problems.push(`package version is not semver: ${pkg.version}`)
  if (pkg.repository?.url !== `git+${REPOSITORY}.git`) problems.push('repository.url must point to the OpenFairWind repository')
  if (pkg.bugs?.url !== `${REPOSITORY}/issues`) problems.push('bugs.url must point to the OpenFairWind issue tracker')
  if (pkg.homepage !== `${REPOSITORY}#readme`) problems.push('homepage must point to the OpenFairWind README')

  if (!Array.isArray(pkg.files) || pkg.files.length === 0) problems.push('package.json must use a files whitelist')
  for (const entry of pkg.files || []) {
    if (FORBIDDEN_PACKAGE_ENTRIES.includes(entry)) problems.push(`files whitelist must not publish ${entry}`)
    if (!fs.existsSync(path.join(root, entry))) problems.push(`files whitelist entry does not exist: ${entry}`)
  }

  const icon = pkg.signalk?.appIcon
  if (typeof icon !== 'string' || path.isAbsolute(icon) || icon.startsWith('public/')) {
    problems.push('signalk.appIcon must be relative to public/')
  } else {
    const iconPath = path.join(root, 'public', icon)
    if (!fs.existsSync(iconPath)) problems.push(`signalk.appIcon not found: public/${icon}`)
    else {
      const size = pngSize(fs.readFileSync(iconPath))
      if (!size) problems.push('signalk.appIcon must be a PNG raster image')
      else if (size.width < 72 || size.height < 72) problems.push(`signalk.appIcon must be at least 72x72, found ${size.width}x${size.height}`)
    }
  }

  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const escaped = String(pkg.version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`^## ${escaped}(\\s|$)`, 'm').test(changelog)) problems.push(`CHANGELOG.md has no "## ${pkg.version}" entry`)

  const checkScript = pkg.scripts?.check || ''
  const sources = fs.readdirSync(root).filter(name => name.endsWith('.js'))
  for (const source of sources) {
    if (!checkScript.includes(`node --check ${source}`)) problems.push(`npm run check does not syntax-check ${source}`)
  }
  if (!checkScript.includes('datagrams/*.js')) problems.push('npm run check does not syntax-check datagrams/*.js')
  if (!checkScript.includes('public/app.js')) problems.push('npm run check does not syntax-check public/app.js')

  if (options.tag !== undefined && options.tag !== `v${pkg.version}`) {
    problems.push(`release tag ${options.tag} does not match v${pkg.version}`)
  }

  return { version: pkg.version, problems }
}

if (require.main === module) {
  const tagIndex = process.argv.indexOf('--tag')
  const tag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined
  const { version, problems } = verifyPackage(undefined, { tag })
  if (problems.length) {
    for (const problem of problems) console.error(`✖ ${problem}`)
    process.exit(1)
  }
  console.log(`✔ signalk-to-stalk ${version} package metadata is consistent${tag ? ` with ${tag}` : ''}`)
}

module.exports = { verifyPackage, pngSize }
