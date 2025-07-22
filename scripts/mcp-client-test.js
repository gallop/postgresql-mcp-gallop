#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const mainScript = join(projectRoot, 'dist', 'index.js');
const logFile = join(projectRoot, 'mcp-server.log');

console.log('🔍 MCP Client Test');
console.log('==================');

// 创建一个简单的JSON-RPC 2.0请求 - listTools
const listToolsRequest = {
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
  console.error('❌ Test timed out after 30 seconds');
  serverProcess.kill();
  process.exit(1);
}, 30000);

// 处理服务器标准输出
let responseBuffer = '';
serverProcess.stdout.on('data', (data) => {
  const dataStr = data.toString();
  responseBuffer += dataStr;
  
  try {
    // 尝试解析JSON响应
    const lines = responseBuffer.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        console.log('📥 Received response:', JSON.stringify(response, null, 2));
        
        // 如果是listTools响应，发送postgresql_query请求
        if (response.jsonrpc === '2.0' && response.id === 1 && response.result) {
          console.log('✅ listTools request successful!');
          console.log('📋 Available tools:', response.result.tools.map(t => t.name).join(', '));
          
          // 发送postgresql_query请求
          const queryRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'callTool',
            params: {
              name: 'postgresql_query',
              args: {
                query: 'SELECT current_database() as db, current_user as user, version() as version',
                params: []
              }
            }
          };
          
          console.log('📤 Sending query request:', JSON.stringify(queryRequest, null, 2));
          serverProcess.stdin.write(JSON.stringify(queryRequest) + '\n');
          responseBuffer = '';
        }
        
        // 如果是postgresql_query响应，结束测试
        if (response.jsonrpc === '2.0' && response.id === 2 && response.result) {
          console.log('✅ postgresql_query request successful!');
          console.log('📊 Query result:', JSON.stringify(response.result, null, 2));
          
          // 成功完成测试
          clearTimeout(timeout);
          console.log('✅ All tests passed!');
          serverProcess.kill();
          process.exit(0);
        }
      } catch (e) {
        // 不是有效的JSON，继续等待
      }
    }
  } catch (e) {
    // 解析错误，继续等待更多数据
  }
});

// 处理错误
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ Server error: ${data.toString().trim()}`);
});

serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0 && code !== null) {
    console.error(`❌ Server process exited with code ${code}`);
    process.exit(1);
  }
});

// 发送listTools请求
console.log('📤 Sending listTools request:', JSON.stringify(listToolsRequest, null, 2));
serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');