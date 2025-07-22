#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setTimeout as sleep } from 'timers/promises';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const serverScript = join(__dirname, 'start-mcp-server.js');

console.log('🔍 Testing MCP Client with Redirected Server');
console.log('========================================');

// 启动MCP服务器进程
console.log(`🚀 Starting MCP server using: ${serverScript}`);
const serverProcess = spawn('node', [serverScript], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 设置超时
const timeout = setTimeout(() => {
  console.error('❌ Test timed out after 15 seconds');
  serverProcess.kill();
  process.exit(1);
}, 15000);

// 缓存服务器响应
let responseBuffer = '';

// 处理服务器输出
serverProcess.stdout.on('data', async (data) => {
  const output = data.toString().trim();
  console.log(`📤 Server stdout: ${output}`);
  
  // 当看到服务器启动成功的消息时，发送测试请求
  if (output.includes('MCP Server started')) {
    // 等待服务器完全准备好
    console.log('⏳ Waiting for server to initialize...');
    await sleep(2000);
    
    // 发送listTools请求
    sendRequest('listTools');
    
    // 等待响应处理
    await sleep(2000);
    
    // 发送postgresql_query请求
    sendRequest('postgresql_query', {
      query: 'SELECT version();',
      params: []
    });
  }
  
  // 尝试解析JSON-RPC响应
  try {
    // 将新数据添加到缓冲区
    responseBuffer += output;
    
    // 尝试解析完整的JSON对象
    const lines = responseBuffer.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        console.log('✅ Received JSON-RPC response:', JSON.stringify(response, null, 2));
        
        // 清除已处理的行
        responseBuffer = lines.slice(i + 1).join('\n');
        
        // 如果收到了postgresql_query的响应，可以结束测试
        if (response.id === 2) {
          console.log('🎉 Test completed successfully!');
          clearTimeout(timeout);
          serverProcess.kill();
          process.exit(0);
        }
      } catch (e) {
        // 不是有效的JSON，继续处理下一行
      }
    }
  } catch (e) {
    console.error('❌ Error parsing response:', e.message);
  }
});

// 处理服务器错误输出
serverProcess.stderr.on('data', (data) => {
  console.error(`❌ Server stderr: ${data.toString().trim()}`);
});

// 处理服务器进程关闭
serverProcess.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`🔌 Server process closed with code ${code}`);
  process.exit(code || 0);
});

// 发送JSON-RPC请求到服务器
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: method === 'listTools' ? 1 : 2,
    method,
    params
  };
  
  console.log(`📤 Sending ${method} request:`, JSON.stringify(request, null, 2));
  
  try {
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
    console.log('✅ Request sent successfully');
  } catch (e) {
    console.error('❌ Error sending request:', e.message);
  }
}

// 10秒后强制结束测试
setTimeout(() => {
  console.log('⏱️ Maximum test duration reached, shutting down...');
  serverProcess.kill();
  process.exit(0);
}, 10000);