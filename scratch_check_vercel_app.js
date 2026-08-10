const https = require("https");

https.get("https://coretech-project.vercel.app/login", (res) => {
  console.log("coretech-project.vercel.app Status:", res.statusCode);
  console.log("coretech-project.vercel.app Headers:", JSON.stringify(res.headers, null, 2));
  
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    const match = data.match(/"buildId":"([^"]+)"/);
    if (match) {
      console.log("Build ID:", match[1]);
    } else {
      console.log("No Build ID.");
    }
  });
}).on("error", console.error);
