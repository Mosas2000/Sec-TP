#!/usr/bin/env node

/**
 * Release Script for TipStream SDK
 * 
 * Handles versioning, changelog generation, and publishing.
 * 
 * Usage:
 *   node scripts/release.js [patch|minor|major|<version>]
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

const PACKAGES = [
  'packages/core',
  'packages/security',
  'packages/metrics',
];

const CHANGELOG_PATH = './CHANGELOG.md';

/**
 * Execute a command and return output
 */
function exec(command, options = {}) {
  console.log(`$ ${command}`);
  return execSync(command, { encoding: 'utf8', ...options }).trim();
}

/**
 * Prompt user for input
 */
async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Get current version from root package.json
 */
async function getCurrentVersion() {
  const pkg = JSON.parse(await fs.readFile('./package.json', 'utf8'));
  return pkg.version;
}

/**
 * Calculate new version
 */
function calculateNewVersion(current, bump) {
  const [major, minor, patch] = current.replace(/-.*$/, '').split('.').map(Number);

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      // Assume it's a specific version
      return bump;
  }
}

/**
 * Update version in a package.json file
 */
async function updatePackageVersion(packagePath, newVersion) {
  const pkgPath = path.join(packagePath, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  pkg.version = newVersion;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Get git commits since last tag
 */
function getCommitsSinceLastTag() {
  try {
    const lastTag = exec('git describe --tags --abbrev=0 2>/dev/null || echo ""');
    if (!lastTag) {
      return exec('git log --oneline').split('\n');
    }
    return exec(`git log ${lastTag}..HEAD --oneline`).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Categorize commits by type
 */
function categorizeCommits(commits) {
  const categories = {
    feat: [],
    fix: [],
    docs: [],
    chore: [],
    test: [],
    refactor: [],
    security: [],
    other: [],
  };

  for (const commit of commits) {
    const match = commit.match(/^\w+\s+(\w+)(?:\([^)]+\))?:/);
    const type = match ? match[1] : 'other';
    
    if (type in categories) {
      categories[type].push(commit);
    } else {
      categories.other.push(commit);
    }
  }

  return categories;
}

/**
 * Generate changelog entry
 */
function generateChangelogEntry(version, categories) {
  const date = new Date().toISOString().split('T')[0];
  const lines = [`## [${version}] - ${date}`, ''];

  const typeLabels = {
    feat: 'Added',
    fix: 'Fixed',
    security: 'Security',
    docs: 'Documentation',
    refactor: 'Changed',
    chore: 'Maintenance',
  };

  for (const [type, commits] of Object.entries(categories)) {
    if (commits.length === 0) continue;
    
    const label = typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
    lines.push(`### ${label}`);
    
    for (const commit of commits) {
      // Remove commit hash and type prefix
      const message = commit.replace(/^\w+\s+\w+(?:\([^)]+\))?:\s*/, '');
      lines.push(`- ${message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Update changelog file
 */
async function updateChangelog(newEntry) {
  let content = '';
  
  try {
    content = await fs.readFile(CHANGELOG_PATH, 'utf8');
  } catch {
    content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Insert new entry after header
  const headerEnd = content.indexOf('\n## ');
  if (headerEnd !== -1) {
    content = content.slice(0, headerEnd) + '\n' + newEntry + content.slice(headerEnd);
  } else {
    content += '\n' + newEntry;
  }

  await fs.writeFile(CHANGELOG_PATH, content);
}

/**
 * Run pre-release checks
 */
async function runChecks() {
  console.log('\n📋 Running pre-release checks...\n');

  // Check for uncommitted changes
  const status = exec('git status --porcelain');
  if (status) {
    throw new Error('Working directory is not clean. Commit or stash changes first.');
  }

  // Run tests
  console.log('Running tests...');
  exec('npm test', { stdio: 'inherit' });

  // Run linting
  console.log('Running linting...');
  exec('npm run lint', { stdio: 'inherit' });

  // Run security audit
  console.log('Running security audit...');
  try {
    exec('npm audit --audit-level=high');
  } catch (error) {
    console.warn('⚠️  Security audit found issues. Review before releasing.');
  }

  console.log('\n✅ All checks passed!\n');
}

/**
 * Build all packages
 */
async function buildPackages() {
  console.log('\n📦 Building packages...\n');
  exec('npm run build', { stdio: 'inherit' });
  console.log('\n✅ Build complete!\n');
}

/**
 * Create git tag and commit
 */
async function createRelease(version) {
  console.log('\n🏷️  Creating release...\n');

  exec('git add .');
  exec(`git commit -m "chore(release): v${version}"`);
  exec(`git tag -a v${version} -m "Release v${version}"`);

  console.log(`\n✅ Created tag v${version}\n`);
}

/**
 * Main release function
 */
async function release() {
  console.log('\n🚀 TipStream SDK Release Script\n');
  console.log('================================\n');

  const args = process.argv.slice(2);
  const bump = args[0] || 'patch';

  // Get versions
  const currentVersion = await getCurrentVersion();
  const newVersion = calculateNewVersion(currentVersion, bump);

  console.log(`Current version: ${currentVersion}`);
  console.log(`New version: ${newVersion}\n`);

  // Confirm
  const confirm = await prompt(`Proceed with release v${newVersion}? (y/n) `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('Release cancelled.');
    process.exit(0);
  }

  // Run checks
  await runChecks();

  // Build packages
  await buildPackages();

  // Update versions
  console.log('\n📝 Updating versions...\n');
  await updatePackageVersion('.', newVersion);
  for (const pkg of PACKAGES) {
    await updatePackageVersion(pkg, newVersion);
    console.log(`  Updated ${pkg}/package.json`);
  }

  // Generate changelog
  console.log('\n📝 Generating changelog...\n');
  const commits = getCommitsSinceLastTag();
  const categories = categorizeCommits(commits);
  const changelogEntry = generateChangelogEntry(newVersion, categories);
  await updateChangelog(changelogEntry);
  console.log('  Updated CHANGELOG.md');

  // Create release
  await createRelease(newVersion);

  console.log('\n🎉 Release prepared successfully!\n');
  console.log('Next steps:');
  console.log('  1. Review the changes');
  console.log('  2. Push to remote: git push origin main --tags');
  console.log('  3. GitHub Actions will publish to npm\n');
}

release().catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
