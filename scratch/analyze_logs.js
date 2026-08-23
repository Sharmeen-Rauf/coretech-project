const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "build_logs_full.txt");
const lines = fs.readFileSync(filePath, "utf8").split("\n");

console.log(`TOTAL LINES IN LOG FILE: ${lines.length}`);

// Print the last 150 log messages
const messages = [];
lines.forEach(line => {
  if (!line.trim()) return;
  try {
    const parsed = JSON.parse(line);
    if (parsed.msg) {
      messages.push(`[${parsed.phase || "info"}] ${parsed.msg}`);
    } else if (parsed.source === "stderr" && parsed.msg) {
      messages.push(`[${parsed.phase || "stderr"}] STDERR: ${parsed.msg}`);
    }
  } catch {
    // If not JSON
    messages.push(line);
  }
});

console.log("LAST 100 MESSAGES:");
console.log(messages.slice(-100).join("\n"));
