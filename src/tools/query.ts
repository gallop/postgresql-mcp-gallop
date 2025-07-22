import { z } from 'zod';
import { DatabaseManager } from '../database.js';
import {
  QueryParamsSchema,
  MCPToolResponse,
  ValidationError,
  DatabaseError,
} from '../types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export async function handleQuery(
  db: DatabaseManager,
  args: unknown
): Promise<MCPToolResponse> {
  try {
    // Validate input parameters
    const params = QueryParamsSchema.parse(args);
    
    logger.info('Executing query tool', {
      queryLength: params.query.length,
      hasParams: !!params.params,
      paramsCount: params.params?.length || 0,
    });

    // Security check: ensure it's a SELECT query
    const trimmedQuery = params.query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select') && !trimmedQuery.startsWith('with')) {
      throw new ValidationError(
        'Query tool only supports SELECT and WITH statements for security reasons'
      );
    }

    // Execute the query
    const result = await db.query(params.query, params.params);
    
    logger.info('Query executed successfully', {
      rowCount: result.rowCount,
      fieldsCount: result.fields?.length || 0,
    });

    // Format the response
    let responseText: string;
    
    if (result.rows.length === 0) {
      responseText = 'Query executed successfully but returned no rows.';
    } else {
      // Format as a table-like structure
      const headers = result.fields?.map(field => field.name) || Object.keys(result.rows[0] || {});
      const maxRows = Math.min(result.rows.length, 100); // Limit display to 100 rows
      
      responseText = `Query executed successfully. Returned ${result.rowCount} row(s).\n\n`;
      
      if (headers.length > 0) {
        // Create header row
        responseText += headers.join(' | ') + '\n';
        responseText += headers.map(() => '---').join(' | ') + '\n';
        
        // Add data rows
        for (let i = 0; i < maxRows; i++) {
          const row = result.rows[i];
          const values = headers.map(header => {
            const value = row[header];
            if (value === null) return 'NULL';
            if (value === undefined) return 'UNDEFINED';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          });
          responseText += values.join(' | ') + '\n';
        }
        
        if (result.rows.length > maxRows) {
          responseText += `\n... and ${result.rows.length - maxRows} more rows (truncated for display)`;
        }
      } else {
        // Fallback to JSON format if no headers
        responseText += JSON.stringify(result.rows.slice(0, maxRows), null, 2);
        if (result.rows.length > maxRows) {
          responseText += `\n\n... and ${result.rows.length - maxRows} more rows (truncated for display)`;
        }
      }
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
    logger.error('Query tool error', {
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
export const queryToolDefinition = {
  name: 'postgresql_query',
  description: 'Execute a PostgreSQL SELECT query and return the results',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The SQL SELECT query to execute. Only SELECT and WITH statements are allowed for security.',
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