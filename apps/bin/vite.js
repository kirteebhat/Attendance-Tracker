#!/usr/bin/env node
/**
 * Vercel Monorepo Vite Shim
 * Ensures that if Vercel executes "vite build" in /apps, it resolves
 * and triggers the monorepo web build from the root directory.
 */
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

console.log('[vorldx-monorepo] Invoking Vite build from root workspace...');
try {
  execSync('npm run build:web', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });
  console.log('[vorldx-monorepo] Build completed successfully.');
} catch (error) {
  console.error('[vorldx-monorepo] Build failed:', error.message);
  process.exit(error.status || 1);
}

