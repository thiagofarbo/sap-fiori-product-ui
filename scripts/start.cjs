const { fork, spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }
}

function track(child) {
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
  return child;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const proxy = track(fork(path.join(root, "northwind-proxy.cjs"), [], {
  cwd: root,
  stdio: ["inherit", "inherit", "inherit", "ipc"]
}));

// Inicia o Fiori somente depois que o proxy estiver escutando.
proxy.once("message", (message) => {
  if (message !== "ready" || stopping) return;
  track(spawn(process.execPath, [
    path.join(root, "node_modules/@sap/ux-ui5-tooling/bin/fiori.cjs"),
    "run", "--open", "test/flp.html#app-preview"
  ], { cwd: root, stdio: "inherit" }));
});
