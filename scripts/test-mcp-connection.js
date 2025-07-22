#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');

console.log('🔍 Testing MCP Server connection...');

// 创建一个简单的JSON-RPC 2.0请求
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'listTools',
  params: {}
};

// 启动MCP服务器进程
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // 将日志输出重定向到stderr
    LOG_FORMAT: 'text',
    LOG_LEVEL: 'error'
  }
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 5 seconds');
  serverProcess.kill();
  process.exit(1);
}, 5000);

// 处理服务器输出
let responseData = '';
serverProcess.stdout.on('data', (data) => {
  const dataStr = data.toString();
  console.log(`📤 Server output: ${dataStr}`);
  responseData += dataStr;
  
  try {
    // 尝试解析JSON响应
    const response = JSON.parse(responseData);
    if (response.jsonrpc === '2.0' && response.id === 1) {
      console.log('✅ Received valid JSON-RPC 2.0 response!');
      console.log('📋 Available tools:', response.result?.tools || 'None');
      clearTimeout(timeout);
      serverProcess.kill();
      process.exit(0);
    }
  } catch (e) {
    // 可能是不完整的JSON，继续等待更多数据
  }
});

// 处理错误
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ Server error: ${data.toString()}`);
});

serverProcess.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Server process exited with code ${code}`);
    process.exit(1);
  }
});

// 发送测试请求
console.log('📤 Sending test request:', JSON.stringify(testRequest));
serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');