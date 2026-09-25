// Real mode in one command (backend in Docker + Orbit and Relay against it).
//   pnpm real:setup   first time: .env, install, build, start, create the super-admin
//   pnpm real         every day: start the backend, wait for NOVA Core, run both apps
//   pnpm real:stop    stop the backend (data stays in the Docker volumes)
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const frontendDir = path.join(import.meta.dirname, "..");
const repoRoot = path.join(frontendDir, "..");
const envFile = path.join(repoRoot, ".env");
const envExample = path.join(repoRoot, ".env.example");
const isWindows = process.platform === "win32";

function step(message) {
  console.log(`\n> ${message}`);
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

// pnpm is a .cmd shim on Windows and needs a shell; its arguments here are fixed words.
function pnpmCommand(args) {
  return isWindows ? [`pnpm ${args.join(" ")}`, [], true] : ["pnpm", args, false];
}

function run(command, args, { cwd = repoRoot, capture = false } = {}) {
  const [file, fileArgs, shell] = command === "pnpm" ? pnpmCommand(args) : [command, args, false];
  const result = spawnSync(file, fileArgs, {
    cwd,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    shell,
  });
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  return result;
}

function mustRun(command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) fail(`Failed: ${command} ${args.join(" ")}`);
  return result;
}

function checkDocker() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    fail(
      "Docker is not running. Start Docker Desktop, wait until it says 'running', then try again.",
    );
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "localhost" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function checkAppPorts() {
  for (const [port, app] of [
    [3000, "Orbit"],
    [3001, "Relay"],
  ]) {
    if (await portInUse(port)) {
      fail(
        `Port ${port} (${app}) is already in use. Stop the other dev server first ` +
          "(for example pnpm review or an earlier pnpm real), then try again.",
      );
    }
  }
}

function coreUrl() {
  const env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const port = /^NOVA_CORE_PORT=(\d+)/m.exec(env)?.[1] ?? "8000";
  return `http://127.0.0.1:${port}/api/v1/health`;
}

async function waitForCore(seconds = 120) {
  const url = coreUrl();
  step(`Waiting for NOVA Core (${url})`);
  for (let i = 0; i < seconds; i += 2) {
    try {
      if ((await fetch(url)).ok) {
        console.log("  NOVA Core is up.");
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail("NOVA Core did not answer. Check the logs: docker compose logs core migrate");
}

function setEnvValue(text, key, value) {
  return text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
}

function createEnvFile() {
  if (existsSync(envFile)) {
    console.log("  .env already exists: kept as it is.");
    return;
  }
  let env = readFileSync(envExample, "utf8");
  env = setEnvValue(env, "NOVA_INTERNAL_TOKEN", randomBytes(32).toString("hex"));
  // An existing database keeps its old password, so only pick a new one for a fresh volume.
  const volume = spawnSync("docker", ["volume", "inspect", "nova_db-data"], { stdio: "ignore" });
  if (volume.status === 0) {
    console.log("  Existing database volume found: POSTGRES_PASSWORD left as in .env.example.");
  } else {
    env = setEnvValue(env, "POSTGRES_PASSWORD", randomBytes(18).toString("hex"));
  }
  writeFileSync(envFile, env);
  console.log("  Created .env with random secrets.");
}

function fillBrokerTokenKey() {
  const env = readFileSync(envFile, "utf8");
  if (!/^NOVA_BROKER_TOKEN_KEY=\s*$/m.test(env)) return;
  const result = mustRun(
    "docker",
    [
      "compose",
      "run",
      "--rm",
      "--no-deps",
      "broker",
      "python",
      "-m",
      "nova_broker",
      "new-token-key",
    ],
    { capture: true },
  );
  const key = result.stdout.trim().split(/\r?\n/).pop();
  writeFileSync(envFile, setEnvValue(env, "NOVA_BROKER_TOKEN_KEY", key));
  console.log("  Added NOVA_BROKER_TOKEN_KEY to .env.");
}

async function createAdmin() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("  This is the email and password you sign in with. Leave the email empty to skip.");
  const email = (await rl.question("  Email: ")).trim();
  if (!email) {
    rl.close();
    console.log("  Skipped. Create it later with: pnpm real:admin");
    return;
  }
  const name = (await rl.question("  Your name: ")).trim() || "Admin";
  rl.close();
  console.log("  Password: at least 12 characters (typing is hidden).");
  const result = run("docker", [
    "compose",
    "exec",
    "core",
    "python",
    "-m",
    "nova_core",
    "create-admin",
    "--email",
    email,
    "--name",
    name,
  ]);
  if (result.status !== 0)
    console.log("  Not created (see the message above). Retry with: pnpm real:admin");
}

async function setup() {
  checkDocker();
  step("1/6 Environment file (.env)");
  createEnvFile();
  step("2/6 Installing frontend packages");
  mustRun("pnpm", ["install"], { cwd: frontendDir });
  step("3/6 Building the backend image");
  mustRun("docker", ["compose", "build"]);
  step("4/6 Broker token key");
  fillBrokerTokenKey();
  step("5/6 Starting the backend");
  mustRun("docker", ["compose", "up", "-d"]);
  await waitForCore();
  step("6/6 Super-admin sign-in");
  await createAdmin();
  console.log("\nDONE: Setup done. From now on start everything with: pnpm real");
}

async function start() {
  if (!existsSync(envFile)) fail("No .env yet. First time? Run: pnpm real:setup");
  checkDocker();
  await checkAppPorts();
  step("Starting the backend (docker compose up -d)");
  mustRun("docker", ["compose", "up", "-d"]);
  await waitForCore();
  step("Starting Orbit (http://localhost:3000) and Relay (http://localhost:3001). Ctrl+C to stop.");
  const [file, args, shell] = pnpmCommand([
    "--filter",
    "nova-orbit",
    "--filter",
    "nova-relay",
    "--parallel",
    "run",
    "dev:real",
  ]);
  const apps = spawn(file, args, { cwd: frontendDir, stdio: "inherit", shell });
  apps.on("exit", () => {
    console.log("\nApps stopped. The backend is still running: stop it with pnpm real:stop");
  });
}

const command = process.argv[2] ?? "start";
if (command === "setup") await setup();
else if (command === "admin") {
  checkDocker();
  await createAdmin();
} else if (command === "stop") {
  checkDocker();
  mustRun("docker", ["compose", "down"]);
  console.log("\nDONE: Backend stopped. Your data is kept.");
} else await start();
