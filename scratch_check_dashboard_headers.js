const https = require("https");

https.get("https://www.coretechsolar.com/dashboard", (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", JSON.stringify(res.headers, null, 2));
}).on("error", console.error);
