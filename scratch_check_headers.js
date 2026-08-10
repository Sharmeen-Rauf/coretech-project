const https = require("https");

const options = {
  hostname: "www.coretechsolar.com",
  port: 443,
  path: "/login",
  method: "GET",
  headers: {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  }
};

const req = https.request(options, (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", JSON.stringify(res.headers, null, 2));
  
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    const match = data.match(/"buildId":"([^"]+)"/);
    if (match) {
      console.log("Found Build ID on Server:", match[1]);
    } else {
      console.log("Could not find Build ID in HTML response.");
    }
  });
});

req.on("error", (e) => {
  console.error(e);
});

req.end();
