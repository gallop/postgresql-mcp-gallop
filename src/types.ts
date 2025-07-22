import { z } from 'zod';

// Database configuration schema
export const DatabaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().positive().default(5432),
  database: z.string(),
  user: z.string(),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
  poolMin: z.number().int().positive().default(2),
  poolMax: z.number().int().positive().default(10),
  poolIdleTimeout: z.number().int().positive().default(30000),
  queryTimeout: z.number().int().positive().default(5000),
  maxRows: z.number().int().positive().default(1000),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Query parameters schema
export const QueryParamsSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  params: z.array(z.any()).optional(),
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

// Execute parameters schema
export const ExecuteParamsSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  params: z.array(z.any()).optional(),
});

export type ExecuteParams = z.infer<typeof ExecuteParamsSchema>;

// Column definition schema
export const ColumnDefinitionSchema = z.object({
  name: z.string().min(1, 'Column name cannot be empty'),
  type: z.string().min(1, 'Column type cannot be empty'),
  constraints: z.string().optional(),
});

export interface ColumnDefinition {
  name: string;
  type: string;
  constraints?: string | undefined;
}

export type ColumnDefinitionInferred = z.infer<typeof ColumnDefinitionSchema>;

// Create table parameters schema
export const CreateTableParamsSchema = z.object({
  tableName: z.string().min(1, 'Table name cannot be empty'),
  columns: z.array(ColumnDefinitionSchema).min(1, 'At least one column is required'),
  ifNotExists: z.boolean().default(true),
});

export type CreateTableParams = z.infer<typeof CreateTableParamsSchema>;

// Describe table parameters schema
export const DescribeTableParamsSchema = z.object({
  tableName: z.string().min(1, 'Table name cannot be empty'),
});

export type DescribeTableParams = z.infer<typeof DescribeTableParamsSchema>;

// Database query result interface
export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: any[];
}

// Database execute result interface
export interface ExecuteResult {
  rowCount: number;
  command: string;
}

// Table information interface
export interface TableInfo {
  tableName: string;
  schemaName: string;
  tableType: string;
}

// Column information interface
export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
}

// MCP tool response interface
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly issues?: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Logger interface
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

// Environment variables interface
export interface EnvironmentConfig {
  POSTGRES_HOST: string;
  POSTGRES_PORT: string;
  POSTGRES_DATABASE: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_SSL: string;
  POSTGRES_SSL_REJECT_UNAUTHORIZED?: string;
  POSTGRES_CONNECTION_TIMEOUT?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_POOL_MIN?: string;
  POSTGRES_POOL_MAX?: string;
  POSTGRES_POOL_IDLE_TIMEOUT?: string;
  POSTGRES_QUERY_TIMEOUT?: string;
  POSTGRES_MAX_ROWS?: string;
  LOG_LEVEL?: string;
  LOG_FORMAT?: string;
  LOG_SQL_QUERIES?: string;
  MCP_SERVER_NAME?: string;
  MCP_SERVER_VERSION?: string;
}