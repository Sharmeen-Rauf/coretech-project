const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://cypbnnohtipwavcwukhl.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNDc1MywiZXhwIjoyMDk3MjAwNzUzfQ.e_GJVgR1HF5NYnZk7l6KfbZSGthlAa79oX6CLiZASj4";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  console.log("Querying installer_jobs...");
  const { data, error } = await supabase
    .from("installer_jobs")
    .select(`
      id,
      job_title,
      address,
      status,
      payment_status,
      created_at,
      photos,
      notes,
      serial_number,
      remarks,
      incentive,
      installer:profiles!installer_id(first_name, last_name, phone)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Query succeeded! Total jobs:", data.length);
    console.log("First job:", JSON.stringify(data[0], null, 2));
  }
})();
