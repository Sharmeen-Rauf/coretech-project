const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const filePath = path.join(__dirname, "build_logs_full.txt");
const buffer = fs.readFileSync(filePath);

try {
  const decompressed = zlib.brotliDecompressSync(buffer);
  const text = decompressed.toString("utf8");
  const lines = text.split("\n");
  console.log(`TOTAL DECOMPRESSED LINES: ${lines.length}`);
  
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
      messages.push(line);
    }
  });

  console.log("LAST 120 MESSAGES:");
  console.log(messages.slice(-120).join("\n"));
} catch (err) {
  console.error("Brotli decompression failed:", err);
}
