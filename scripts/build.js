#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('🔨 Building PostgreSQL MCP Gallop...');

try {
  // Clean dist directory
  if (fs.existsSync(distDir)) {
    console.log('🧹 Cleaning dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Create dist directory
  fs.mkdirSync(distDir, { recursive: true });

  // Compile TypeScript
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Make the main script executable
  const mainScript = path.join(distDir, 'index.js');
  if (fs.existsSync(mainScript)) {
    // Add shebang to the compiled JavaScript
    const content = fs.readFileSync(mainScript, 'utf8');
    if (!content.startsWith('#!/usr/bin/env node')) {
      fs.writeFileSync(mainScript, '#!/usr/bin/env node\n' + content);
    }
    
    // Make executable on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(mainScript, '755');
    }
  }

  console.log('✅ Build completed successfully!');
  console.log(`📁 Output directory: ${distDir}`);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}