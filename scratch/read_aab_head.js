const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "coretech-mobile", "build-1.0.0.aab");
console.log(fs.readFileSync(file, "utf8"));
