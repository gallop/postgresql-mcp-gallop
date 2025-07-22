#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');

console.log('🔍 MCP Client Debug Test');
console.log('=====================');
console.log(`Main script path: ${mainScript}`);

// 创建一个简单的JSON-RPC 2.0请求
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'listTools',
  params: {}
};

// 启动MCP服务器进程
console.log('🚀 Starting MCP server process...');
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LOG_LEVEL: 'debug',  // 使用debug级别以获取更多信息
    LOG_FORMAT: 'text'
  }
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 10 seconds');
  serverProcess.kill();
  process.exit(1);
}, 10000);

// 处理服务器标准输出
console.log('👂 Listening for server stdout...');
serverProcess.stdout.on('data', (data) => {
  const dataStr = data.toString().trim();
  console.log(`📤 Server stdout: [${dataStr}]`);
  
  try {
    // 尝试解析JSON
    const json = JSON.parse(dataStr);
    console.log('✅ Successfully parsed JSON response');
  } catch (e) {
    console.log(`❌ Not valid JSON: ${e.message}`);
  }
});

// 处理错误
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ Server stderr: ${data.toString().trim()}`);
});

serverProcess.on('error', (err) => {
  console.error(`❌ Server process error: ${err.message}`);
});

serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`🔌 Server process closed with code ${code}`);
});

// 等待服务器启动
console.log('⏳ Waiting 2 seconds before sending request...');
setTimeout(() => {
  // 发送测试请求
  console.log('📤 Sending test request:', JSON.stringify(testRequest));
  serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  console.log('📤 Request sent!');
  
  // 5秒后关闭进程
  setTimeout(() => {
    console.log('⏱️ Test duration completed');
    serverProcess.kill();
    process.exit(0);
  }, 5000);
}, 2000);