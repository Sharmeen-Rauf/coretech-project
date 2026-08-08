const { verifySerialNumberAction } = require("./app/actions/products");

async function main() {
  console.log("TESTING verifySerialNumberAction...");
  const res = await verifySerialNumberAction("CTNX-8kW-2605190039", "new");
  console.log("RESULT:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
