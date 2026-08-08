const { submitInstallationAction, verifySerialNumberAction } = require("./app/actions/products");

async function main() {
  console.log("1. TESTING VERIFY FOR CTNX-8kW-2605190039...");
  const vRes = await verifySerialNumberAction("CTNX-8kW-2605190039", "new");
  console.log("VERIFY RESULT:", JSON.stringify(vRes, null, 2));

  if (!vRes.success) {
    console.error("VERIFICATION FAILED!");
    return;
  }

  console.log("\n2. TESTING SUBMIT FOR CTNX-8kW-2605190039...");
  const payload = {
    id: "5e476090-b058-4550-a6ea-30b3acbd6f51", // Re-submitting existing job
    installer_id: "1d811896-6cc7-43b4-b34c-349a0dfb7868",
    job_title: "CoreTech 10KW",
    address: "Karachi",
    status: "pending_verification",
    serial_number: "CTNX-8kW-2605190039",
    remarks: "Re-submitted test proof",
    photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
    notes: "[METADATA] SN:CTNX-8kW-2605190039 | VIDEO: | REM:Re-submitted test proof\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)",
    incentive: 5000,
    payment_status: "unpaid",
    created_at: new Date().toISOString()
  };

  const sRes = await submitInstallationAction(payload, "5e476090-b058-4550-a6ea-30b3acbd6f51");
  console.log("SUBMIT RESULT:", JSON.stringify(sRes, null, 2));
}

main().catch(console.error);
