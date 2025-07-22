import { z } from 'zod';
import { DatabaseManager } from '../database.js';
import {
  CreateTableParamsSchema,
  DescribeTableParamsSchema,
  MCPToolResponse,
  ValidationError,
  DatabaseError,
} from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export async function handleCreateTable(
  db: DatabaseManager,
  args: unknown
): Promise<MCPToolResponse> {
  try {
    // Validate input parameters
    const params = CreateTableParamsSchema.parse(args);
    
    logger.info('Creating table', {
      tableName: params.tableName,
      columnCount: params.columns.length,
      ifNotExists: params.ifNotExists,
    });

    // Validate table name (basic SQL injection prevention)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(params.tableName)) {
      throw new ValidationError(
        'Invalid table name. Table names must start with a letter or underscore and contain only letters, numbers, and underscores.'
      );
    }

    // Validate column names
    for (const column of params.columns) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
        throw new ValidationError(
          `Invalid column name '${column.name}'. Column names must start with a letter or underscore and contain only letters, numbers, and underscores.`
        );
      }
    }

    // Execute the create table command
    const result = await db.createTable(
      params.tableName,
      params.columns,
      params.ifNotExists
    );
    
    logger.info('Table created successfully', {
      tableName: params.tableName,
      command: result.command,
    });

    const responseText = `Table '${params.tableName}' created successfully with ${params.columns.length} column(s).\n\nColumns:\n${params.columns.map(col => `- ${col.name}: ${col.type}${col.constraints ? ` ${col.constraints}` : ''}`).join('\n')}`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    logger.error('Create table tool error', {
      error: error instanceof Error ? error.message : String(error),
      type: error?.constructor?.name,
    });

    let errorMessage: string;
    
    if (error instanceof ValidationError) {
      errorMessage = `Validation Error: ${error.message}`;
    } else if (error instanceof DatabaseError) {
      errorMessage = `Database Error: ${error.message}`;
      if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
      if (error.detail) {
        errorMessage += `\nDetail: ${error.detail}`;
      }
    } else if (error instanceof z.ZodError) {
      const issueDetails = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      errorMessage = `Input Validation Error: ${issueDetails}`;
    } else {
      errorMessage = `Unexpected Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

export async function handleDescribeTable(
  db: DatabaseManager,
  args: unknown
): Promise<MCPToolResponse> {
  try {
    // Validate input parameters
    const params = DescribeTableParamsSchema.parse(args);
    
    logger.info('Describing table', {
      tableName: params.tableName,
    });

    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(params.tableName)) {
      throw new ValidationError(
        'Invalid table name. Table names must start with a letter or underscore and contain only letters, numbers, and underscores.'
      );
    }

    // Get table structure
    const columns = await db.describeTable(params.tableName);
    
    if (columns.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Table '${params.tableName}' not found or has no columns.`,
          },
        ],
      };
    }

    logger.info('Table described successfully', {
      tableName: params.tableName,
      columnCount: columns.length,
    });

    // Format the response
    let responseText = `Table '${params.tableName}' structure:\n\n`;
    responseText += 'Column Name | Data Type | Nullable | Default | Max Length | Precision | Scale\n';
    responseText += '--- | --- | --- | --- | --- | --- | ---\n';
    
    for (const column of columns) {
      const nullable = column.isNullable ? 'YES' : 'NO';
      const defaultValue = column.columnDefault || 'NULL';
      const maxLength = column.characterMaximumLength || 'N/A';
      const precision = column.numericPrecision || 'N/A';
      const scale = column.numericScale || 'N/A';
      
      responseText += `${column.columnName} | ${column.dataType} | ${nullable} | ${defaultValue} | ${maxLength} | ${precision} | ${scale}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    logger.error('Describe table tool error', {
      error: error instanceof Error ? error.message : String(error),
      type: error?.constructor?.name,
    });

    let errorMessage: string;
    
    if (error instanceof ValidationError) {
      errorMessage = `Validation Error: ${error.message}`;
    } else if (error instanceof DatabaseError) {
      errorMessage = `Database Error: ${error.message}`;
      if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
    } else if (error instanceof z.ZodError) {
      const issueDetails = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      errorMessage = `Input Validation Error: ${issueDetails}`;
    } else {
      errorMessage = `Unexpected Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

export async function handleListTables(
  db: DatabaseManager
): Promise<MCPToolResponse> {
  try {
    logger.info('Listing tables');

    // Get all tables
    const tables = await db.listTables();
    
    logger.info('Tables listed successfully', {
      tableCount: tables.length,
    });

    if (tables.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No tables found in the database.',
          },
        ],
      };
    }

    // Format the response
    let responseText = `Found ${tables.length} table(s) in the database:\n\n`;
    responseText += 'Schema | Table Name | Type\n';
    responseText += '--- | --- | ---\n';
    
    for (const table of tables) {
      responseText += `${table.schemaName} | ${table.tableName} | ${table.tableType}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    logger.error('List tables tool error', {
      error: error instanceof Error ? error.message : String(error),
      type: error?.constructor?.name,
    });

    let errorMessage: string;
    
    if (error instanceof DatabaseError) {
      errorMessage = `Database Error: ${error.message}`;
      if (error.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
    } else {
      errorMessage = `Unexpected Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

// Tool definitions for MCP
export const createTableToolDefinition = {
  name: 'postgresql_create_table',
  description: 'Create a new table in the PostgreSQL database',
  inputSchema: {
    type: 'object',
    properties: {
      tableName: {
        type: 'string',
        description: 'Name of the table to create. Must be a valid SQL identifier.',
      },
      columns: {
        type: 'array',
        description: 'Array of column definitions',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Column name. Must be a valid SQL identifier.',
            },
            type: {
              type: 'string',
              description: 'PostgreSQL data type (e.g., VARCHAR(100), INTEGER, TIMESTAMP, etc.)',
            },
            constraints: {
              type: 'string',
              description: 'Optional column constraints (e.g., NOT NULL, PRIMARY KEY, UNIQUE, DEFAULT value)',
            },
          },
          required: ['name', 'type'],
        },
        minItems: 1,
      },
      ifNotExists: {
        type: 'boolean',
        description: 'Whether to use IF NOT EXISTS clause to avoid errors if table already exists',
        default: true,
      },
    },
    required: ['tableName', 'columns'],
  },
};

export const describeTableToolDefinition = {
  name: 'postgresql_describe_table',
  description: 'Get detailed information about a table structure including columns, data types, and constraints',
  inputSchema: {
    type: 'object',
    properties: {
      tableName: {
        type: 'string',
        description: 'Name of the table to describe. Must be a valid SQL identifier.',
      },
    },
    required: ['tableName'],
  },
};

export const listTablesToolDefinition = {
  name: 'postgresql_list_tables',
  description: 'List all tables in the PostgreSQL database',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};