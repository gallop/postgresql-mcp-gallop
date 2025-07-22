#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');

console.log('🔍 Direct MCP Server Test');
console.log('========================');
console.log(`Main script: ${mainScript}`);

// 直接启动MCP服务器进程
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LOG_FORMAT: 'text',
    LOG_LEVEL: 'debug'
  }
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 10 seconds');
  serverProcess.kill();
  process.exit(1);
}, 10000);

// 处理服务器标准输出
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`📤 STDOUT: ${output.trim()}`);
  
  // 如果看到服务器启动成功，发送测试请求
  if (output.includes('PostgreSQL MCP Server started successfully')) {
    console.log('✅ Server started successfully, sending test request...');
    
    const testRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'listTools',
      params: {}
    };
    
    console.log(`📤 Sending: ${JSON.stringify(testRequest)}`);
    serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  }
  
  // 尝试解析JSON响应
  try {
    const response = JSON.parse(output.trim());
    console.log('✅ Received JSON response:', JSON.stringify(response, null, 2));
    
    // 如果收到响应，测试成功
    if (response.id === 1) {
      console.log('🎉 Test completed successfully!');
      clearTimeout(timeout);
      serverProcess.kill();
      process.exit(0);
    }
  } catch (e) {
    // 不是JSON，继续
  }
});

// 处理服务器错误输出
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ STDERR: ${data.toString().trim()}`);
});

// 处理进程退出
serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`🔌 Server process closed with code ${code}`);
  process.exit(code || 0);
});

// 处理错误
serverProcess.on('error', (error) => {
  console.error(`❌ Process error: ${error.message}`);
  clearTimeout(timeout);
  process.exit(1);
});

console.log('🚀 Server process started, waiting for output...');