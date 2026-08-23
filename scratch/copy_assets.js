const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "../coretech-mobile/assets");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const sourceFile = "C:/Users/Muneef Rauf/.gemini/antigravity-ide/brain/e986d7ea-0dbc-4c21-8866-ee4787990d1e/icon_1787294192176.jpg";
const targets = ["icon.png", "adaptive-icon.png", "favicon.png", "splash.png"];

targets.forEach(target => {
  const destPath = path.join(assetsDir, target);
  fs.copyFileSync(sourceFile, destPath);
  console.log(`Copied asset to ${destPath}`);
});
