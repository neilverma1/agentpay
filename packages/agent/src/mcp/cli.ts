#!/usr/bin/env node
import { startAgentPayStdioServer } from './server';

startAgentPayStdioServer().catch((error) => {
  process.stderr.write(
    `AgentPay MCP Server fatal error: ${error instanceof Error ? error.stack || error.message : String(error)}\n`,
  );
  process.exit(1);
});
