const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const filePath = path.join(__dirname, "build_logs_full.txt");
const buffer = fs.readFileSync(filePath);

console.log("File length:", buffer.length);
console.log("Magic bytes (Hex):", buffer.slice(0, 10).toString("hex"));

const methods = [
  { name: "gunzipSync", fn: zlib.gunzipSync },
  { name: "inflateSync", fn: zlib.inflateSync },
  { name: "inflateRawSync", fn: zlib.inflateRawSync },
  { name: "brotliDecompressSync", fn: zlib.brotliDecompressSync },
  { name: "unzipSync", fn: zlib.unzipSync }
];

methods.forEach(m => {
  try {
    const res = m.fn(buffer);
    console.log(`Successfully decompressed with ${m.name}! Result length:`, res.length);
    fs.writeFileSync(path.join(__dirname, "decompressed_text.txt"), res);
  } catch (err) {
    console.log(`Failed with ${m.name}:`, err.message);
  }
});
