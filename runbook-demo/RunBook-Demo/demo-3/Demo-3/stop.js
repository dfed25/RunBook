const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PID_FILE = path.join(__dirname, ".server.pid");
const DEFAULT_PORT = Number(process.env.PORT || 8082);

function killPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch (error) {
    if (error && error.code === "ESRCH") return false;
    throw error;
  }
}

function findWindowsPidByPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const lines = output.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pidCandidate = Number(parts[parts.length - 1]);
      if (Number.isInteger(pidCandidate) && pidCandidate > 0) {
        return pidCandidate;
      }
    }
  } catch {
    return null;
  }
  return null;
}

if (!fs.existsSync(PID_FILE)) {
  const fallbackPid = findWindowsPidByPort(DEFAULT_PORT);
  if (!fallbackPid) {
    console.log("No running server PID file found.");
    process.exit(0);
  }
  try {
    const killed = killPid(fallbackPid);
    if (killed) {
      console.log(`Stopped server on port ${DEFAULT_PORT} (PID ${fallbackPid}).`);
    } else {
      console.log("Server process not found.");
    }
    process.exit(0);
  } catch (error) {
    console.error("Could not stop server:", error.message);
    process.exit(1);
  }
}

const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
if (!Number.isInteger(pid) || pid <= 0) {
  fs.unlinkSync(PID_FILE);
  console.log("Invalid PID file removed.");
  process.exit(0);
}

try {
  killPid(pid);
  fs.unlinkSync(PID_FILE);
  console.log(`Stopped server process ${pid}.`);
} catch (error) {
  if (error && error.code === "ESRCH") {
    fs.unlinkSync(PID_FILE);
    console.log("Server process not found. Removed stale PID file.");
    process.exit(0);
  }
  console.error("Could not stop server:", error.message);
  process.exit(1);
}
