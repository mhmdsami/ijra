import { spawn } from "node:child_process";

const port = process.env.SMOKE_PORT ?? "3123";
const base = `http://localhost:${port}`;
const server = spawn("npx", ["next", "dev", "--port", port], { cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"] });

let logs = "";
server.stdout.on("data", (chunk) => { logs += chunk; });
server.stderr.on("data", (chunk) => { logs += chunk; });

function stop() {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
  }
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(base, { signal: AbortSignal.timeout(5_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`server did not start within ${timeoutMs}ms\n${logs.slice(-2000)}`);
}

async function check(path, expected, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}${path}`, { redirect: "manual" });
      const body = await res.text();
      if (res.status < 500 && (!expected || body.includes(expected))) {
        console.log(`smoke: ${path} ${res.status} ok`);
        return;
      }
      last = `status ${res.status}, missing ${JSON.stringify(expected)}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${path} never rendered: ${last}`);
}

try {
  await waitForServer();
  await check("/", "ijra");
  await check("/login", "ijra");
  console.log("smoke: passed");
} catch (error) {
  console.error(`smoke: failed - ${error.message}`);
  stop();
  process.exit(1);
} finally {
  stop();
}
