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

console.log('🚀 Starting MCP Server with redirected logging');
console.log(`Main script: ${mainScript}`);
console.log(`Log file: ${logFile}`);

// 创建日志文件流
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 启动MCP服务器进程
const serverProcess = spawn('node', [mainScript], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // 将日志输出重定向到stderr
    LOG_FORMAT: 'text',
    LOG_LEVEL: 'info'
  },
  detached: false // 确保进程不会分离
});

// 将标准错误输出重定向到日志文件
serverProcess.stderr.pipe(logStream);

// 处理服务器标准输出 - 只将日志信息写入日志文件，保持stdout纯净
serverProcess.stdout.on('data', (data) => {
  const dataStr = data.toString();
  // 检查是否是日志信息（以时间戳开头）
  if (dataStr.trim().startsWith('[') || dataStr.trim().startsWith('{"timestamp"')) {
    logStream.write(dataStr);
  } else {
    // 如果不是日志信息，则输出到控制台
    process.stdout.write(dataStr);
  }
});

// 处理进程退出
serverProcess.on('close', (code) => {
  console.log(`MCP Server process exited with code ${code}`);
  logStream.end();
});

// 处理信号
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  serverProcess.kill('SIGTERM');
});

console.log('MCP Server started. Press Ctrl+C to stop.');

// 保持进程运行
process.stdin.resume();