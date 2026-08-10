const https = require("https");

const options = {
  hostname: "api.github.com",
  port: 443,
  path: "/repos/Sharmeen-Rauf/coretech-project/commits/master/check-runs",
  method: "GET",
  headers: {
    "User-Agent": "NodeJS-App"
  }
};

const req = https.get(options, (res) => {
  console.log("Status Code:", res.statusCode);
  
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    try {
      const parsed = JSON.parse(data);
      console.log("Check Runs Count:", parsed.total_count);
      if (parsed.check_runs) {
        parsed.check_runs.forEach((run) => {
          console.log(`- Name: ${run.name}`);
          console.log(`  Status: ${run.status}`);
          console.log(`  Conclusion: ${run.conclusion}`);
          console.log(`  URL: ${run.details_url}`);
        });
      }
    } catch (e) {
      console.error("Parse Error:", e);
      console.log(data);
    }
  });
});

req.on("error", console.error);
