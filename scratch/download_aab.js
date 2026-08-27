const https = require("https");
const fs = require("fs");
const path = require("path");

const url = "https://expo.dev/artifacts/eas/6bj5-K_ARk_3RVeyCRKBOcSZUoJv7582bmjxfNcTH2c.aab";
const dest = path.join(__dirname, "..", "coretech-mobile", "build-1.0.0-api35-version7.aab");

console.log("Fetching first level redirection URL...");
https.get(url, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    const targetUrl = body.trim();
    console.log(`Target artifact API URL: ${targetUrl}`);
    
    https.get(targetUrl, (apiRes) => {
      let apiBody = "";
      apiRes.on("data", chunk => apiBody += chunk);
      apiRes.on("end", () => {
        const match = apiBody.match(/https:\/\/wf-artifacts\.eascdn\.net\/[^\s"]+/);
        if (!match) {
          console.error("Could not find direct download URL in body:", apiBody);
          return;
        }
        
        let s3Url = match[0].replace(/&amp;/g, "&");
        if (s3Url.endsWith(".")) s3Url = s3Url.slice(0, -1);
        console.log(`Direct AWS S3 download URL: ${s3Url}`);
        
        console.log("Downloading binary AAB from S3...");
        const fileStream = fs.createWriteStream(dest);
        https.get(s3Url, (s3Res) => {
          s3Res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            console.log(`Success! File size: ${fs.statSync(dest).size} bytes`);
          });
        }).on("error", (err) => console.error("S3 download failed:", err));
      });
    }).on("error", (err) => console.error("API fetch failed:", err));
  });
}).on("error", (err) => console.error("Redirect fetch failed:", err));
