#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');

let serverProcess = null;
let isBuilding = false;

console.log('🚀 Starting PostgreSQL MCP Gallop in development mode...');

// Initial build
build().then(() => {
  startServer();
  watchFiles();
}).catch((error) => {
  console.error('❌ Initial build failed:', error.message);
  process.exit(1);
});

function build() {
  if (isBuilding) {
    return Promise.resolve();
  }
  
  isBuilding = true;
  console.log('🔨 Building...');
  
  return new Promise((resolve, reject) => {
    try {
      // Clean dist directory
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }
      fs.mkdirSync(distDir, { recursive: true });

      // Compile TypeScript
      execSync('npx tsc', {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      // Make the main script executable
      const mainScript = path.join(distDir, 'index.js');
      if (fs.existsSync(mainScript)) {
        const content = fs.readFileSync(mainScript, 'utf8');
        if (!content.startsWith('#!/usr/bin/env node')) {
          fs.writeFileSync(mainScript, '#!/usr/bin/env node\n' + content);
        }
        
        if (process.platform !== 'win32') {
          fs.chmodSync(mainScript, '755');
        }
      }

      console.log('✅ Build completed');
      isBuilding = false;
      resolve();
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      isBuilding = false;
      reject(error);
    }
  });
}

function startServer() {
  if (serverProcess) {
    console.log('🔄 Restarting server...');
    serverProcess.kill('SIGTERM');
  }

  const mainScript = path.join(distDir, 'index.js');
  if (!fs.existsSync(mainScript)) {
    console.error('❌ Main script not found:', mainScript);
    return;
  }

  console.log('🌟 Starting server...');
  serverProcess = spawn('node', [mainScript], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  serverProcess.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') {
      console.log(`🔴 Server exited with code ${code}`);
    }
    serverProcess = null;
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    serverProcess = null;
  });
}

function watchFiles() {
  console.log('👀 Watching for file changes...');
  
  const watcher = chokidar.watch(srcDir, {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
  });

  let timeout = null;
  
  const handleChange = (eventPath) => {
    console.log(`📝 File changed: ${path.relative(projectRoot, eventPath)}`);
    
    // Debounce rebuilds
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      build().then(() => {
        startServer();
      }).catch((error) => {
        console.error('❌ Rebuild failed:', error.message);
      });
    }, 500);
  };

  watcher
    .on('add', handleChange)
    .on('change', handleChange)
    .on('unlink', handleChange)
    .on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });

  console.log('✅ Development server is ready!');
  console.log('💡 Edit files in src/ to trigger automatic rebuilds');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});