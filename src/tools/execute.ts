import { z } from 'zod';
import { DatabaseManager } from '../database.js';
import {
  ExecuteParamsSchema,
  MCPToolResponse,
  ValidationError,
  DatabaseError,
} from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

// List of allowed SQL commands for security
const ALLOWED_COMMANDS = [
  'insert',
  'update',
  'delete',
  'create',
  'alter',
  'drop',
  'truncate',
  'grant',
  'revoke',
];

// List of dangerous commands that should be blocked
const DANGEROUS_COMMANDS = [
  'drop database',
  'drop schema',
  'drop user',
  'drop role',
  'shutdown',
  'restart',
];

export async function handleExecute(
  db: DatabaseManager,
  args: unknown
): Promise<MCPToolResponse> {
  try {
    // Validate input parameters
    const params = ExecuteParamsSchema.parse(args);
    
    logger.info('Executing command tool', {
      queryLength: params.query.length,
      hasParams: !!params.params,
      paramsCount: params.params?.length || 0,
    });

    // Security checks
    const trimmedQuery = params.query.trim().toLowerCase();
    
    // Check for dangerous commands
    for (const dangerousCmd of DANGEROUS_COMMANDS) {
      if (trimmedQuery.includes(dangerousCmd)) {
        throw new ValidationError(
          `Dangerous command detected: ${dangerousCmd}. This operation is not allowed for security reasons.`
        );
      }
    }

    // Extract the first word (command) from the query
    const firstWord = params.query.trim().split(/\s+/)[0]?.toLowerCase();

    // Check if command starts with an allowed operation
    if (!firstWord || !ALLOWED_COMMANDS.includes(firstWord)) {
      throw new ValidationError(
        `Command '${firstWord}' is not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`
      );
    }

    // Additional security check for SELECT statements
    if (firstWord === 'select' || trimmedQuery.startsWith('with')) {
      throw new ValidationError(
        'SELECT and WITH statements should use the postgresql_query tool instead'
      );
    }

    // Execute the command
    const result = await db.execute(params.query, params.params);
    
    logger.info('Command executed successfully', {
      command: result.command,
      rowCount: result.rowCount,
    });

    // Format the response based on the command type
    let responseText: string;
    
    switch (result.command.toLowerCase()) {
      case 'insert':
        responseText = `INSERT operation completed successfully. ${result.rowCount} row(s) inserted.`;
        break;
      case 'update':
        responseText = `UPDATE operation completed successfully. ${result.rowCount} row(s) updated.`;
        break;
      case 'delete':
        responseText = `DELETE operation completed successfully. ${result.rowCount} row(s) deleted.`;
        break;
      case 'create':
        responseText = `CREATE operation completed successfully.`;
        break;
      case 'alter':
        responseText = `ALTER operation completed successfully.`;
        break;
      case 'drop':
        responseText = `DROP operation completed successfully.`;
        break;
      case 'truncate':
        responseText = `TRUNCATE operation completed successfully. All rows removed from table.`;
        break;
      case 'grant':
        responseText = `GRANT operation completed successfully. Permissions granted.`;
        break;
      case 'revoke':
        responseText = `REVOKE operation completed successfully. Permissions revoked.`;
        break;
      default:
        responseText = `${result.command} operation completed successfully. ${result.rowCount} row(s) affected.`;
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
    logger.error('Execute tool error', {
      error: error instanceof Error ? error.message : String(error),
      type: error?.constructor?.name,
    });

    let errorMessage: string;
    
    if (error instanceof ValidationError) {
      errorMessage = `Validation Error: ${error.message}`;
      if (error.issues) {
        const issueDetails = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        errorMessage += `\nDetails: ${issueDetails}`;
      }
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

// Tool definition for MCP
export const executeToolDefinition = {
  name: 'postgresql_execute',
  description: 'Execute PostgreSQL INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, or REVOKE commands',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The SQL command to execute. Allowed commands: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE. Dangerous operations are blocked for security.',
      },
      params: {
        type: 'array',
        description: 'Optional array of parameters for parameterized queries (recommended for security)',
        items: {
          type: 'string',
        },
      },
    },
    required: ['query'],
  },
};