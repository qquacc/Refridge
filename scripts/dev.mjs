import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const portIndex = process.argv.indexOf("--port");
const mainPort =
  portIndex >= 0
    ? process.argv[portIndex + 1]
    : process.env.FRONTEND_PORT || "5173";
const children = [
  spawn(process.execPath, ["--watch", "backend/server.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "8787" },
  }),
  spawn(
    "npm",
    ["run", "dev", "-w", "@refridge/main", "--", "--port", mainPort],
    { stdio: "inherit" },
  ),
  spawn("npm", ["run", "dev", "-w", "@refridge/camera"], { stdio: "inherit" }),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const c of children) c.kill(signal);
    process.exit(0);
  });
