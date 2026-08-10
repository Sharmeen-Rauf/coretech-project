const { submitInstallationAction } = require("../app/actions/products");

(async () => {
  const payload = {
    id: "f35392c1-719d-42cc-bfaf-2645303e3413",
    installer_id: "1d811896-6cc7-43b4-b34c-349a0dfb7868",
    job_title: "yaa allah reham",
    address: "malir colony",
    status: "pending_verification",
    serial_number: "CTNX-8kW-2605190193",
    remarks: "",
    photos: ["https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/verification/1786346490940-96iq1t.png"],
    notes: "[METADATA] SN:CTNX-8kW-2605190193 | VIDEO:https://cypbnnohtipwavcwukhl.supabase.co/storage/v1/object/public/job-photos/installer-videos/1786346490938-qckfth.mp4 | REM:\nCONNECTED PRODUCT: CoreTech NexGen 8KW IP66 (NexGen 8KW)",
    incentive: 5000,
    payment_status: "unpaid"
  };

  const res = await submitInstallationAction(payload, "f35392c1-719d-42cc-bfaf-2645303e3413");
  console.log("SUBMISSION RESULT:", res);
})();
