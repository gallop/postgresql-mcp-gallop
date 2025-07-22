#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');

console.log('🔍 Testing MCP Server stdio communication...');

// 创建一个简单的JSON-RPC 2.0请求
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'listTools',
  params: {}
};

// 启动MCP服务器进程，将日志输出重定向到文件
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LOG_LEVEL: 'error',
    LOG_FORMAT: 'text'
  }
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 5 seconds');
  serverProcess.kill();
  process.exit(1);
}, 5000);

// 处理服务器输出
serverProcess.stdout.on('data', (data) => {
  const dataStr = data.toString().trim();
  console.log(`📤 Server stdout: ${dataStr}`);
});

// 处理错误
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ Server stderr: ${data.toString().trim()}`);
});

serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0 && code !== null) {
    console.error(`❌ Server process exited with code ${code}`);
    process.exit(1);
  }
});

// 发送测试请求
console.log('📤 Sending test request:', JSON.stringify(testRequest));
serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');

// 5秒后关闭进程
setTimeout(() => {
  console.log('✅ Test completed');
  serverProcess.kill();
  process.exit(0);
}, 3000);