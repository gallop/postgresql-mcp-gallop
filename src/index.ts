#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from './database.js';
import { createLogger } from './utils/logger.js';
import {
  handleQuery,
  queryToolDefinition,
} from './tools/query.js';
import {
  handleExecute,
  executeToolDefinition,
} from './tools/execute.js';
import {
  handleCreateTable,
  handleDescribeTable,
  handleListTables,
  createTableToolDefinition,
  describeTableToolDefinition,
  listTablesToolDefinition,
} from './tools/schema.js';
import { MCPToolResponse } from './types.js';

const logger = createLogger();

// Parse command line arguments
function parseConnectionString(): string | undefined {
  const args = process.argv.slice(2);
  
  // Look for a PostgreSQL connection string in arguments
  for (const arg of args) {
    if (arg.startsWith('postgresql://') || arg.startsWith('postgres://')) {
      return arg;
    }
  }
  
  return undefined;
}

// Initialize the MCP server
const server = new Server(
  {
    name: process.env['MCP_SERVER_NAME'] || 'postgresql-mcp-gallop',
    version: process.env['MCP_SERVER_VERSION'] || '1.0.0',
    capabilities: {
      tools: {},
    },
  }
);

// Initialize database manager
let db: DatabaseManager;

try {
  const connectionString = parseConnectionString();
  db = new DatabaseManager(connectionString);
  logger.info('Database manager initialized successfully', {
    usingConnectionString: !!connectionString
  });
} catch (error) {
  logger.error('Failed to initialize database manager', { error });
  process.exit(1);
}

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Listing available tools');
  
  return {
    tools: [
      {
        name: queryToolDefinition.name,
        description: queryToolDefinition.description,
        inputSchema: queryToolDefinition.inputSchema,
      },
      {
        name: executeToolDefinition.name,
        description: executeToolDefinition.description,
        inputSchema: executeToolDefinition.inputSchema,
      },
      {
        name: createTableToolDefinition.name,
        description: createTableToolDefinition.description,
        inputSchema: createTableToolDefinition.inputSchema,
      },
      {
        name: describeTableToolDefinition.name,
        description: describeTableToolDefinition.description,
        inputSchema: describeTableToolDefinition.inputSchema,
      },
      {
        name: listTablesToolDefinition.name,
        description: listTablesToolDefinition.description,
        inputSchema: listTablesToolDefinition.inputSchema,
      },
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  logger.info('Tool called', {
    toolName: name,
    hasArguments: !!args,
  });

  let response: MCPToolResponse;

  try {
    switch (name) {
      case 'postgresql_query':
        response = await handleQuery(db, args);
        break;

      case 'postgresql_execute':
        response = await handleExecute(db, args);
        break;

      case 'postgresql_create_table':
        response = await handleCreateTable(db, args);
        break;

      case 'postgresql_describe_table':
        response = await handleDescribeTable(db, args);
        break;

      case 'postgresql_list_tables':
        response = await handleListTables(db);
        break;

      default:
        logger.error('Unknown tool called', { toolName: name });
        throw new Error(`Unknown tool: ${name}`);
    }

    logger.info('Tool executed successfully', {
      toolName: name,
      isError: response.isError || false,
    });

    return {
      content: response.content
    };
  } catch (error) {
    logger.error('Tool execution failed', {
      toolName: name,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Note: Health check functionality is available through database connection testing

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, initiating graceful shutdown');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, initiating graceful shutdown');
  await gracefulShutdown();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown().then(() => process.exit(1));
});

async function gracefulShutdown(): Promise<void> {
  try {
    logger.info('Starting graceful shutdown');
    
    // Close database connections
    if (db) {
      await db.gracefulShutdown();
    }
    
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
  }
}

// Start the server
async function main(): Promise<void> {
  try {
    logger.info('Starting PostgreSQL MCP Server', {
      serverName: process.env['MCP_SERVER_NAME'] || 'postgresql-mcp-gallop',
      serverVersion: process.env['MCP_SERVER_VERSION'] || '1.0.0',
      nodeVersion: process.version,
    });

    // Test database connection on startup (non-blocking)
    try {
      const isConnected = await db.testConnection();
      if (isConnected) {
        logger.info('Database connection test successful');
      } else {
        logger.warn('Database connection test failed - server will continue running');
      }
    } catch (error) {
      logger.warn('Database connection test error - server will continue running', { error });
    }

    // Create transport and connect
    logger.info('Creating StdioServerTransport...');
    const transport = new StdioServerTransport();
    
    logger.info('Connecting server to transport...');
    await server.connect(transport);
    
    logger.info('PostgreSQL MCP Server started successfully');
    
    // Keep the server running
    process.stdin.resume();
    
    // Handle graceful shutdown
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await gracefulShutdown();
      process.exit(0);
    };
    
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Only run main if this file is executed directly
const scriptPath = process.argv[1];
if (scriptPath && import.meta.url.endsWith(scriptPath.replace(/\\/g, '/'))) {
  main().catch((error) => {
    logger.error('Fatal error in main', { error });
    process.exit(1);
  });
} else {
  // For debugging: always run main in development
  logger.debug('Module condition check', {
    importMetaUrl: import.meta.url,
    processArgv1: scriptPath,
    condition: scriptPath ? import.meta.url.endsWith(scriptPath.replace(/\\/g, '/')) : false
  });
  
  // Run main anyway for now
  main().catch((error) => {
    logger.error('Fatal error in main', { error });
    process.exit(1);
  });
}

export { server, db };