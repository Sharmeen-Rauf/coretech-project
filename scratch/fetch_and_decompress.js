const https = require("https");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const url = "https://storage.googleapis.com/eas-workflows-production/logs/a8b44c98-8ccc-447a-8033-1c1bc4a906d8/ddc3a942-4c4d-4684-b9b4-0234aaab36ec/2026-08-23T21%3A37%3A52Z-4c71eb28-92ef-49e4-aab7-12eb88534e0a.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260823%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260823T215339Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=619d11435fa2fe9bc1ea2d86820d27b6033f82fe94b5d4977de0149aa1a45faa88f72fc632186805707414060640facb7537276ebd39ed82a7c3fb8b0a34d192092fe41ffba2512b5a0a5a172e133b6b7220edcdb7c95e2d407caaaa112b13828dc2e45fd0efa93db0621e7226f0b63f3121397531c9ab78b8c5b62a7b10d1d55f7fc329dbbf60e9be06b2a75ee87251faca42132e32a3fd3d0c946523ed6e261f30426716448d3998d13a053b71f5015cf1fb83ec659697b460a3aaa7e7d5ab085e31b273280ef9b887b74a45a84bf57eeac7c7721605ff77e879e7ce0c583a50436af27f9233af63d1dfcc9beca96552be3353578b3363d914a583216d684f";

const dest = path.join(__dirname, "decompressed_logs.txt");

const request = https.get(url, (response) => {
  console.log("Headers:", response.headers);
  
  let stream = response;
  
  // check content-encoding header and decompress accordingly
  const contentEncoding = response.headers["content-encoding"];
  if (contentEncoding === "gzip") {
    console.log("Response is gzipped, pipe through gunzip...");
    stream = response.pipe(zlib.createGunzip());
  } else if (contentEncoding === "deflate") {
    console.log("Response is deflated, pipe through inflate...");
    stream = response.pipe(zlib.createInflate());
  } else {
    // If not declared, let's try auto-unzipping if it looks like gzip
    console.log("No encoding header, piping direct...");
  }
  
  const fileStream = fs.createWriteStream(dest);
  stream.pipe(fileStream);
  
  fileStream.on("finish", () => {
    fileStream.close();
    console.log("Done! Reading decompressed logs count...");
    const content = fs.readFileSync(dest, "utf8");
    console.log("Decompressed content length:", content.length);
    if (content.length > 0) {
      const lines = content.split("\n");
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
      console.log("LAST 50 LINES:");
      console.log(messages.slice(-50).join("\n"));
    }
  });
});

request.on("error", (err) => {
  console.error("Request error:", err);
});
