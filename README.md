# PostgreSQL MCP Server

一个基于 Model Context Protocol (MCP) 的 PostgreSQL 数据库操作服务，支持数据库的读写操作和表结构管理。

## 功能特性

- 🔍 **数据查询**: 执行 SELECT 查询操作
- ✏️ **数据操作**: 支持 INSERT、UPDATE、DELETE 操作
- 🏗️ **表结构管理**: 创建表、查看表结构、列出所有表
- 🔒 **安全性**: 参数化查询防止 SQL 注入
- 📦 **NPX 支持**: 可通过 npx 直接使用
- 🔧 **TypeScript**: 完整的类型支持

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- PostgreSQL 数据库

### 安装

#### 方式一：NPX 直接使用（推荐）
```bash
# 使用连接字符串
npx postgresql-mcp-gallop postgresql://username:password@host:port/database

# 使用环境变量（需要 .env 文件）
npx postgresql-mcp-gallop
```

#### 方式二：本地安装
```bash
npm install -g postgresql-mcp-gallop

# 使用连接字符串
postgresql-mcp-gallop postgresql://username:password@host:port/database

# 使用环境变量
postgresql-mcp-gallop
```

#### 方式三：从源码构建
```bash
git clone <repository-url>
cd postgresql-mcp-gallop

npm install
npm run build

# 使用连接字符串
node dist/index.js postgresql://username:password@host:port/database

# 使用环境变量
npm start
```

### 配置

#### 方式一：命令行参数（推荐）
直接在命令行中传递 PostgreSQL 连接字符串：

```bash
postgresql://username:password@host:port/database
```

示例：
```bash
npx postgresql-mcp-gallop postgresql://postgres:123456@localhost:5432/mydb
```

#### 方式二：环境变量
创建 `.env` 文件并配置数据库连接信息：

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=your_database
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

**注意**：命令行参数的优先级高于环境变量。

## IDE 客户端配置

### Trae AI IDE 配置

在 Trae AI IDE 中使用此 MCP 服务器，请在 `mcp.json` 配置文件中添加以下配置：

```json
{
  "mcpServers": {
    "PostgreSQL": {
      "command": "npx",
      "args": [
        "-y",
        "postgresql-mcp-gallop",
        "postgresql://username:password@host:port/database"
      ],
      "env": {
      },
      "description": "PostgreSQL database operations via MCP"
    }
  }
}
```

**配置说明：**
- `command`: 使用 `npx` 来运行包
- `args`: 包含包名和数据库连接字符串
- 将 `postgresql://username:password@host:port/database` 替换为你的实际数据库连接信息

**示例配置：**
```json
{
  "mcpServers": {
    "PostgreSQL": {
      "command": "npx",
      "args": [
        "-y",
        "postgresql-mcp-gallop",
        "postgresql://postgres:123456@192.168.1.100:5432/chatbi"
      ],
      "env": {
      }
    }
  }
}
```

### 其他 MCP 客户端

对于其他支持 MCP 的客户端，配置方式类似，主要是指定：
1. 命令：`npx`
2. 参数：`["-y", "postgresql-mcp-gallop", "<your-connection-string>"]\`

## MCP 工具列表

### 1. postgresql_query
执行 SELECT 查询操作

**参数:**
- `query` (string): SQL 查询语句

**示例:**
```sql
SELECT * FROM users WHERE age > 18
```

### 2. postgresql_execute
执行 INSERT、UPDATE、DELETE 操作

**参数:**
- `query` (string): SQL 执行语句

**示例:**
```sql
INSERT INTO users (name, email, age) VALUES ('张三', 'zhangsan@example.com', 25)
```

### 3. postgresql_create_table
创建数据库表

**参数:**
- `tableName` (string): 表名
- `columns` (array): 列定义数组
  - `name` (string): 列名
  - `type` (string): 数据类型
  - `constraints` (string, 可选): 约束条件

**示例:**
```json
{
  "tableName": "users",
  "columns": [
    {
      "name": "id",
      "type": "SERIAL",
      "constraints": "PRIMARY KEY"
    },
    {
      "name": "name",
      "type": "VARCHAR(100)",
      "constraints": "NOT NULL"
    },
    {
      "name": "email",
      "type": "VARCHAR(255)",
      "constraints": "UNIQUE NOT NULL"
    },
    {
      "name": "age",
      "type": "INTEGER"
    },
    {
      "name": "created_at",
      "type": "TIMESTAMP",
      "constraints": "DEFAULT CURRENT_TIMESTAMP"
    }
  ]
}
```

### 4. postgresql_describe_table
查看表结构信息

**参数:**
- `tableName` (string): 表名

### 5. postgresql_list_tables
列出数据库中的所有表

**参数:** 无

## 使用示例

### 基本查询
```sql
-- 查询所有用户
SELECT * FROM users;

-- 条件查询
SELECT name, email FROM users WHERE age BETWEEN 18 AND 65;

-- 聚合查询
SELECT COUNT(*) as total_users, AVG(age) as avg_age FROM users;
```

### 数据操作
```sql
-- 插入数据
INSERT INTO users (name, email, age) VALUES 
('李四', 'lisi@example.com', 30),
('王五', 'wangwu@example.com', 28);

-- 更新数据
UPDATE users SET age = 31 WHERE name = '李四';

-- 删除数据
DELETE FROM users WHERE age < 18;
```

### 表结构管理
```sql
-- 创建索引
CREATE INDEX idx_users_email ON users(email);

-- 添加列
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- 修改列
ALTER TABLE users ALTER COLUMN name TYPE VARCHAR(150);
```

## 安全特性

### SQL 注入防护
- 使用参数化查询
- 输入验证和清理
- 限制危险操作

### 权限控制
- 数据库用户权限管理
- 操作类型限制
- 连接数限制

### 错误处理
- 详细的错误日志
- 安全的错误信息返回
- 连接池管理

## 开发指南

### 项目结构
```
postgresql-mcp-gallop/
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── .env.example          # 环境变量示例
├── src/
│   ├── index.ts          # 主入口文件
│   ├── database.ts       # 数据库连接管理
│   ├── tools/            # MCP 工具定义
│   │   ├── query.ts      # 查询工具
│   │   ├── execute.ts    # 执行工具
│   │   └── schema.ts     # 表结构工具
│   └── types.ts          # 类型定义
└── dist/                 # 编译输出
```

### 本地开发
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

### 添加新工具

1. 在 `src/tools/` 目录下创建新的工具文件
2. 实现工具逻辑
3. 在 `src/index.ts` 中注册工具
4. 更新类型定义
5. 添加测试用例

## 配置选项

### 数据库配置
```env
# 基本连接配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mydb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# SSL 配置
POSTGRES_SSL=true
POSTGRES_SSL_CERT=/path/to/cert.pem
POSTGRES_SSL_KEY=/path/to/key.pem
POSTGRES_SSL_CA=/path/to/ca.pem

# 连接池配置
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=10
POSTGRES_POOL_IDLE_TIMEOUT=30000

# 查询配置
POSTGRES_QUERY_TIMEOUT=5000
POSTGRES_MAX_ROWS=1000
```

### 日志配置
```env
# 日志级别: debug, info, warn, error
LOG_LEVEL=info

# 日志输出格式: json, text
LOG_FORMAT=json

# 是否记录 SQL 查询
LOG_SQL_QUERIES=false
```

## 故障排除

### 常见问题

#### 连接失败
```
错误: connection refused
```
**解决方案:**
1. 检查 PostgreSQL 服务是否运行
2. 验证连接参数是否正确
3. 检查防火墙设置
4. 确认数据库用户权限

#### 权限不足
```
错误: permission denied for table
```
**解决方案:**
1. 检查数据库用户权限
2. 授予必要的表操作权限
3. 确认数据库和表是否存在

#### 查询超时
```
错误: query timeout
```
**解决方案:**
1. 优化查询语句
2. 增加查询超时时间
3. 检查数据库性能
4. 添加适当的索引

### 调试模式

启用详细日志：
```bash
LOG_LEVEL=debug npm start
```

查看 SQL 查询：
```bash
LOG_SQL_QUERIES=true npm start
```

## 性能优化

### 连接池优化
- 合理设置连接池大小
- 配置连接超时时间
- 监控连接使用情况

### 查询优化
- 使用索引提高查询性能
- 限制返回结果数量
- 避免复杂的子查询

### 内存管理
- 及时释放数据库连接
- 控制结果集大小
- 使用流式处理大数据

## 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

### 代码规范
- 使用 TypeScript
- 遵循 ESLint 规则
- 添加适当的测试
- 更新相关文档

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如果您遇到问题或有建议，请：

1. 查看 [FAQ](#故障排除) 部分
2. 搜索现有的 [Issues](https://github.com/your-repo/postgresql-mcp/issues)
3. 创建新的 Issue 描述问题
4. 联系维护者

## 更新日志

### v1.0.0
- 初始版本发布
- 基本的 CRUD 操作支持
- 表结构管理功能
- TypeScript 支持

---

**注意**: 请确保在生产环境中使用时，正确配置数据库权限和网络安全设置。