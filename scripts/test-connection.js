#!/usr/bin/env node

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// 初始化环境变量
dotenv.config();

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
  query_timeout: parseInt(process.env.POSTGRES_QUERY_TIMEOUT || '30000'),
};

console.log('🔍 Testing PostgreSQL connection...');
console.log('📋 Configuration:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}`);
console.log(`   SSL: ${config.ssl ? 'enabled' : 'disabled'}`);
console.log('');

async function testConnection() {
  const client = new Client(config);
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('🔍 Testing basic query...');
    const result = await client.query('SELECT version(), current_database(), current_user, now() as current_time');
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('📊 Database Information:');
      console.log(`   Version: ${row.version}`);
      console.log(`   Database: ${row.current_database}`);
      console.log(`   User: ${row.current_user}`);
      console.log(`   Current Time: ${row.current_time}`);
    }
    
    console.log('🔍 Testing table listing...');
    const tablesResult = await client.query(`
      SELECT schemaname, tablename, tableowner 
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY schemaname, tablename
      LIMIT 10
    `);
    
    console.log(`📋 Found ${tablesResult.rows.length} user tables (showing first 10):`);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`   ${row.schemaname}.${row.tablename} (owner: ${row.tableowner})`);
      });
    } else {
      console.log('   No user tables found');
    }
    
    console.log('\n✅ All tests passed! PostgreSQL connection is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Check if PostgreSQL server is running');
    console.error('   2. Verify connection parameters in .env file');
    console.error('   3. Ensure the database and user exist');
    console.error('   4. Check firewall and network connectivity');
    console.error('   5. Verify SSL configuration if using SSL');
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed.');
  }
}

// Check if .env file exists
// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

if (!existsSync(envPath)) {
  console.warn('⚠️  Warning: .env file not found!');
  console.warn('   Create a .env file based on .env.example');
  console.warn('   Using default/environment values for connection');
  console.log('');
}

testConnection().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});