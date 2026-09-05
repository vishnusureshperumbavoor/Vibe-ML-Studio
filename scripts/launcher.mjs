import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const service = process.argv.find((arg) => ["server", "mcp", "client"].includes(arg));
const shouldInstall = process.argv.includes("--install");

const config = {
  client: {
    name: "Client (Vite Frontend)",
    installCmd: "npm install",
    startCmd: "npx vite",
    cwd: rootDir,
  },
  server: {
    name: "Backend Server (Python Kernel)",
    installCmd: "bash start.sh --install",
    startCmd: "bash start.sh",
    cwd: path.join(rootDir, "server"),
  },
  mcp: {
    name: "MCP Bridge",
    installCmd: "npm install",
    startCmd: "node index.mjs",
    cwd: path.join(rootDir, "mcp-bridge"),
  },
};

const target = config[service];

if (!target) {
  console.error(`❌ Unknown service "${service}". Available: client, server, mcp`);
  process.exit(1);
}

console.log(`\n🚀 [VML Studio] Starting ${target.name}${shouldInstall ? " (Installing dependencies first...)" : ""}...\n`);

const fullCommand = shouldInstall
  ? `${target.installCmd} && ${target.startCmd}`
  : target.startCmd;

const child = spawn(fullCommand, {
  stdio: "inherit",
  shell: true,
  cwd: target.cwd,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
