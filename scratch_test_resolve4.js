const dns = require("dns");

dns.resolve4("coretechsolar.com", (err, addresses) => {
  if (err) {
    console.error("resolve4 coretechsolar.com Error:", err);
  } else {
    console.log("IPv4 for coretechsolar.com:", addresses);
  }
});

dns.resolve4("www.coretechsolar.com", (err, addresses) => {
  if (err) {
    console.error("resolve4 www.coretechsolar.com Error:", err);
  } else {
    console.log("IPv4 for www.coretechsolar.com:", addresses);
  }
});
