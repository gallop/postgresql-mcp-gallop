#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');

console.log('🔍 Testing MCP Server with Correct Method Names');
console.log('===============================================');
console.log(`Main script: ${mainScript}`);

// 直接启动MCP服务器进程
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LOG_FORMAT: 'text',
    LOG_LEVEL: 'info'
  }
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 15 seconds');
  serverProcess.kill();
  process.exit(1);
}, 15000);

let testStep = 0;
const tests = [
  {
    name: 'tools/list',
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: 'postgresql_query',
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'postgresql_query',
        arguments: {
          query: 'SELECT version();',
          params: []
        }
      }
    }
  }
];

// 处理服务器标准输出
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`📤 STDOUT: ${output.trim()}`);
  
  // 如果看到服务器启动成功，开始发送测试请求
  if (output.includes('PostgreSQL MCP Server started successfully') && testStep === 0) {
    console.log('✅ Server started successfully, beginning tests...');
    runNextTest();
  }
  
  // 尝试解析JSON响应
  try {
    const response = JSON.parse(output.trim());
    console.log(`✅ Received JSON response for test ${testStep}:`, JSON.stringify(response, null, 2));
    
    // 运行下一个测试
    if (testStep < tests.length) {
      setTimeout(runNextTest, 1000);
    } else {
      console.log('🎉 All tests completed!');
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

function runNextTest() {
  if (testStep >= tests.length) {
    console.log('🎉 All tests completed!');
    clearTimeout(timeout);
    serverProcess.kill();
    process.exit(0);
    return;
  }
  
  const test = tests[testStep];
  testStep++;
  
  console.log(`\n📤 Running test ${testStep}: ${test.name}`);
  console.log(`📤 Sending: ${JSON.stringify(test.request, null, 2)}`);
  
  try {
    serverProcess.stdin.write(JSON.stringify(test.request) + '\n');
    console.log('✅ Request sent successfully');
  } catch (e) {
    console.error('❌ Error sending request:', e.message);
  }
}

console.log('🚀 Server process started, waiting for output...');