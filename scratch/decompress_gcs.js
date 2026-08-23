const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const src = path.join(__dirname, "build_logs_full.txt");
const dest = path.join(__dirname, "decompressed_text.txt");

const compressedBuffer = fs.readFileSync(src);
console.log("Compressed buffer size:", compressedBuffer.length);

try {
  const decompressed = zlib.gunzipSync(compressedBuffer);
  fs.writeFileSync(dest, decompressed);
  console.log(`Decompressed successfully! Saved to ${dest}`);
  
  const text = decompressed.toString("utf8");
  const lines = text.split("\n");
  console.log(`Total decompressed lines: ${lines.length}`);
  
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
  
  console.log("LAST 100 MESSAGES:");
  console.log(messages.slice(-100).join("\n"));
} catch (err) {
  console.error("Gunzip failed:", err);
}
