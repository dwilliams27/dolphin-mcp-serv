import { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { sessionService } from '@/services/session.service';
import { randomUUID } from 'node:crypto';

export const postMcpHandler = async (req: Request, res: Response) => {
  console.log(`Request received: ${req.method} ${req.url}`, {body: req.body});

  const originalJson = res.json;
  res.json = function(body) {
    console.log(`Response being sent:`, JSON.stringify(body, null, 2));
    return originalJson.call(this, body);
  };
  
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.mcpSession?.[1]) {
      console.log(`Reusing MCP transport for session: ${req.mcpSession[0]}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      console.log(`New session request: ${req.body.method}`);

      const eventStore = new InMemoryEventStore();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        eventStore,
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized: ${sessionId}`);
          sessionService.addMcpSession(req.emuSession, sessionId, transport);
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
        sessionService.destroyMcpSession(sid);
        }
      };

      console.log(`Connecting transport to MCP server...`);
      await req.mcpService.getServer().connect(transport);
      console.log(`Transport connected to MCP server successfully`);
      
      console.log(`Handling initialization request...`);
      await transport.handleRequest(req, res, req.body);
      console.log(`Initialization request handled, response sent`);
      return;
    } else {
      console.error('Invalid request: No valid session ID or initialization request');
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    console.log(`Handling request for session: ${req.mcpSession[0]}`);
    console.log(`Request body:`, JSON.stringify(req.body, null, 2));
    
    console.log(`Calling transport.handleRequest...`);
    const startTime = Date.now();
    await req.mcpSession[1].handleRequest(req, res, req.body);
    const duration = Date.now() - startTime;
    console.log(`Request handling completed in ${duration}ms for session: ${req.mcpSession[0]}`);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
}

export const getMcpHandler = async (req: Request, res: Response) => {
  console.log(`GET Request received: ${req.method} ${req.url}`);

  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!req.mcpSession) {
      console.log(`Invalid session ID in GET request: ${sessionId}`);
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.log(`Establishing new SSE stream for session ${sessionId}`);
    }
    
    // Set up connection close monitoring
    res.on('close', () => {
      console.log(`SSE connection closed for session ${sessionId}`);
    });
    
    console.log(`Starting SSE transport.handleRequest for session ${sessionId}...`);
    const startTime = Date.now();
    await req.mcpSession[1].handleRequest(req, res);
    const duration = Date.now() - startTime;
    console.log(`SSE stream setup completed in ${duration}ms for session: ${sessionId}`);
  } catch (error) {
    console.error('Error handling GET request:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
}

export const deleteMcpHandler = async (req: Request, res: Response) => {
  console.log(`DELETE Request received: ${req.method} ${req.url}`);
  try {
    if (!req.mcpSession) {
      console.log(`Invalid session ID in DELETE request`);
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    console.log(`Received session termination request for session ${req.mcpSession[0]}`);

    // Capture response for logging
    const originalSend = res.send;
    res.send = function(body) {
      console.log(`DELETE response being sent:`, body);
      return originalSend.call(this, body);
    };
    
    console.log(`Processing session termination...`);
    const startTime = Date.now();
    await req.mcpSession[1].handleRequest(req, res);
    const duration = Date.now() - startTime;
    console.log(`Session termination completed in ${duration}ms for session: ${req.mcpSession[0]}`);
  } catch (error) {
    console.error('Error handling DELETE request:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
}
