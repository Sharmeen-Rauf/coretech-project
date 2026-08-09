const dns = require("dns");

dns.resolveAny("coretechsolar.com", (err, addresses) => {
  if (err) {
    console.error("DNS Resolution Error:", err);
  } else {
    console.log("DNS records for coretechsolar.com:\n", JSON.stringify(addresses, null, 2));
  }
});

dns.resolveAny("www.coretechsolar.com", (err, addresses) => {
  if (err) {
    console.error("DNS Resolution Error for www:", err);
  } else {
    console.log("DNS records for www.coretechsolar.com:\n", JSON.stringify(addresses, null, 2));
  }
});
