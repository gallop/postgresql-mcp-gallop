#!/usr/bin/env node

// Entry point for the npx command
// This file will be referenced in package.json bin field

const path = require('path');
const { spawn } = require('child_process');

// Get the directory where this script is located
const binDir = __dirname;
const projectRoot = path.resolve(binDir, '..');
const mainScript = path.join(projectRoot, 'dist', 'index.js');

// Check if the compiled JavaScript exists
const fs = require('fs');
if (!fs.existsSync(mainScript)) {
  console.error('Error: Compiled JavaScript not found.');
  console.error('Please run "npm run build" first to compile TypeScript.');
  console.error(`Expected file: ${mainScript}`);
  process.exit(1);
}

// Spawn the main process
const child = spawn('node', [mainScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: projectRoot,
});

// Handle process termination
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

// Exit with the same code as the child process
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});

child.on('error', (error) => {
  console.error('Failed to start postgresql-mcp-gallop:', error.message);
  process.exit(1);
});