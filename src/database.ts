import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import * as dotenv from 'dotenv';
import { URL } from 'url';
import {
  DatabaseConfig,
  DatabaseConfigSchema,
  QueryResult,
  ExecuteResult,
  TableInfo,
  ColumnInfo,
  DatabaseError,
  Logger,
  EnvironmentConfig,
} from './types.js';
import { createLogger } from './utils/logger.js';

// Load environment variables
dotenv.config();

export class DatabaseManager {
  private pool: Pool;
  private config: DatabaseConfig;
  private logger: Logger;

  constructor(connectionString?: string) {
    this.logger = createLogger();
    this.config = this.loadConfig(connectionString);
    this.pool = this.createPool();
    this.setupEventHandlers();
  }

  private loadConfig(connectionString?: string): DatabaseConfig {
    const env = process.env as unknown as EnvironmentConfig;
    
    // Parse connection string if provided
    let parsedConnection: any = {};
    if (connectionString) {
      try {
        const url = new URL(connectionString);
        parsedConnection = {
          host: url.hostname,
          port: url.port ? parseInt(url.port, 10) : 5432,
          database: url.pathname.slice(1), // Remove leading '/'
          user: url.username,
          password: url.password,
        };
        this.logger.info('Parsed connection string successfully', {
          host: parsedConnection.host,
          port: parsedConnection.port,
          database: parsedConnection.database,
          user: parsedConnection.user
        });
      } catch (error) {
        this.logger.error('Failed to parse connection string', { error, connectionString });
        throw new Error(`Invalid connection string: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const rawConfig = {
      host: parsedConnection.host || env['POSTGRES_HOST'] || 'localhost',
      port: parsedConnection.port || parseInt(env['POSTGRES_PORT'] || '5432', 10),
      database: parsedConnection.database || env['POSTGRES_DATABASE'] || 'postgres',
      user: parsedConnection.user || env['POSTGRES_USER'] || 'postgres',
      password: parsedConnection.password || env['POSTGRES_PASSWORD'],
      ssl: env['POSTGRES_SSL'] === 'true',
      sslRejectUnauthorized: env['POSTGRES_SSL_REJECT_UNAUTHORIZED'] !== 'false',
      connectionTimeoutMillis: parseInt(env['POSTGRES_CONNECTION_TIMEOUT'] || '10000', 10),
      queryTimeout: parseInt(env['POSTGRES_QUERY_TIMEOUT'] || '30000', 10),
      maxConnections: parseInt(env['POSTGRES_MAX_CONNECTIONS'] || '10', 10),
      idleTimeoutMillis: parseInt(env['POSTGRES_POOL_IDLE_TIMEOUT'] || '30000', 10),
      poolMin: parseInt(env['POSTGRES_POOL_MIN'] || '2', 10),
      poolMax: parseInt(env['POSTGRES_POOL_MAX'] || '10', 10),
      poolIdleTimeout: parseInt(env['POSTGRES_POOL_IDLE_TIMEOUT'] || '30000', 10),
      maxRows: parseInt(env['POSTGRES_MAX_ROWS'] || '1000', 10),
    };

    try {
      return DatabaseConfigSchema.parse(rawConfig);
    } catch (error) {
      this.logger.error('Invalid database configuration', { error });
      throw new DatabaseError('Invalid database configuration');
    }
  }

  private createPool(): Pool {
    const poolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.poolMin,
      max: this.config.poolMax,
      idleTimeoutMillis: this.config.poolIdleTimeout,
      query_timeout: this.config.queryTimeout,
    };

    this.logger.info('Creating database connection pool', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
    });

    return new Pool(poolConfig);
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (_client: PoolClient) => {
      this.logger.debug('New client connected to database');
    });

    this.pool.on('error', (err: Error) => {
      this.logger.error('Database pool error', { error: err.message });
    });

    this.pool.on('remove', () => {
      this.logger.debug('Client removed from pool');
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing query', {
        query: process.env['LOG_SQL_QUERIES'] === 'true' ? text : '[HIDDEN]',
        paramsCount: params?.length || 0,
      });

      const result: PgQueryResult = await client.query(text, params);
      const duration = Date.now() - startTime;
      
      this.logger.debug('Query completed', {
        rowCount: result.rowCount,
        duration: `${duration}ms`,
      });

      // Limit the number of rows returned
      const limitedRows = result.rows.slice(0, this.config.maxRows);
      if (result.rows.length > this.config.maxRows) {
        this.logger.warn(`Query returned ${result.rows.length} rows, limited to ${this.config.maxRows}`);
      }

      return {
        rows: limitedRows,
        rowCount: result.rowCount || 0,
        fields: result.fields,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Query failed', {
        error: error.message,
        code: error.code,
        duration: `${duration}ms`,
      });
      
      throw new DatabaseError(
        error.message || 'Query execution failed',
        error.code,
        error.detail
      );
    } finally {
      client.release();
    }
  }

  async execute(text: string, params?: any[]): Promise<ExecuteResult> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing command', {
        command: process.env['LOG_SQL_QUERIES'] === 'true' ? text : '[HIDDEN]',
        paramsCount: params?.length || 0,
      });

      const result: PgQueryResult = await client.query(text, params);
      const duration = Date.now() - startTime;
      
      this.logger.debug('Command completed', {
        rowCount: result.rowCount,
        command: result.command,
        duration: `${duration}ms`,
      });

      return {
        rowCount: result.rowCount || 0,
        command: result.command || 'UNKNOWN',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Command failed', {
        error: error.message,
        code: error.code,
        duration: `${duration}ms`,
      });
      
      throw new DatabaseError(
        error.message || 'Command execution failed',
        error.code,
        error.detail
      );
    } finally {
      client.release();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const query = `
      SELECT 
        table_name as "tableName",
        table_schema as "schemaName",
        table_type as "tableType"
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `;

    const result = await this.query(query);
    return result.rows as TableInfo[];
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        column_name as "columnName",
        data_type as "dataType",
        is_nullable = 'YES' as "isNullable",
        column_default as "columnDefault",
        character_maximum_length as "characterMaximumLength",
        numeric_precision as "numericPrecision",
        numeric_scale as "numericScale"
      FROM information_schema.columns 
      WHERE table_name = $1
        AND table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY ordinal_position;
    `;

    const result = await this.query(query, [tableName]);
    return result.rows as ColumnInfo[];
  }

  async createTable(tableName: string, columns: Array<{ name: string; type: string; constraints?: string }>, ifNotExists: boolean = true): Promise<ExecuteResult> {
    const columnDefs = columns.map(col => {
      const constraints = col.constraints ? ` ${col.constraints}` : '';
      return `${col.name} ${col.type}${constraints}`;
    }).join(', ');
    
    const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : '';
    const createTableSQL = `CREATE TABLE ${ifNotExistsClause}${tableName} (${columnDefs})`;
    
    return await this.execute(createTableSQL);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as test');
      this.logger.info('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', { error });
      return false;
    }
  }

  async getPoolStatus(): Promise<{ total: number; idle: number; waiting: number }> {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing database connection pool');
      await this.pool.end();
      this.logger.info('Database connection pool closed successfully');
    } catch (error) {
      this.logger.error('Error closing database connection pool', { error });
      throw new DatabaseError('Failed to close database connection pool');
    }
  }

  // Graceful shutdown handler
  async gracefulShutdown(): Promise<void> {
    this.logger.info('Initiating graceful database shutdown');
    
    // Wait for active connections to finish (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (this.pool.totalCount > this.pool.idleCount && (Date.now() - startTime) < shutdownTimeout) {
      this.logger.debug('Waiting for active connections to finish', {
        active: this.pool.totalCount - this.pool.idleCount,
        total: this.pool.totalCount,
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await this.close();
  }
}