#!/usr/bin/env node
import { runCli } from "../src/cli.js";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`maintainer-gate failed: ${error.message}`);
  process.exit(2);
});
