const https = require("https");
const fs = require("fs");
const path = require("path");

const url = "https://expo.dev/artifacts/eas/nSxA8mUE-Hyz3k6QKAVN2L8OE9QGNTdvGxEI6qtjo9s.aab";
const dest = path.join(__dirname, "..", "coretech-mobile", "build-1.0.0-api35-version6.aab");

console.log("Fetching first level redirection URL...");
https.get(url, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    const targetUrl = body.trim();
    console.log(`Target artifact API URL: ${targetUrl}`);
    
    // Call the API URL to get the HTML redirection page
    https.get(targetUrl, (apiRes) => {
      let apiBody = "";
      apiRes.on("data", chunk => apiBody += chunk);
      apiRes.on("end", () => {
        // Find URL in the body text
        const match = apiBody.match(/https:\/\/wf-artifacts\.eascdn\.net\/[^\s"]+/);
        if (!match) {
          console.error("Could not find direct download URL in body:", apiBody);
          return;
        }
        
        // Clean URL by replacing HTML entities and removing trailing period
        let s3Url = match[0].replace(/&amp;/g, "&");
        if (s3Url.endsWith(".")) {
          s3Url = s3Url.slice(0, -1);
        }
        console.log(`Direct AWS S3 download URL: ${s3Url}`);
        
        // Now fetch S3 binary
        console.log("Downloading binary AAB from S3...");
        const fileStream = fs.createWriteStream(dest);
        https.get(s3Url, (s3Res) => {
          s3Res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            console.log(`Success! Final AAB downloaded successfully. File size: ${fs.statSync(dest).size} bytes`);
          });
        }).on("error", (err) => {
          console.error("Failed to download from S3:", err);
        });
      });
    }).on("error", (err) => {
      console.error("Failed to fetch from API endpoint:", err);
    });
  });
}).on("error", (err) => {
  console.error("Failed to fetch redirection text:", err);
});
