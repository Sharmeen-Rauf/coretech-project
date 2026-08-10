const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://cypbnnohtipwavcwukhl.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNDc1MywiZXhwIjoyMDk3MjAwNzUzfQ.e_GJVgR1HF5NYnZk7l6KfbZSGthlAa79oX6CLiZASj4";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

(async () => {
  const userId = "ec9830b8-ae62-4ba0-944a-95e2a0427e02";
  const newEmail = "munifrauf2@gmail.com";

  console.log(`Updating email for admin user ID ${userId} to '${newEmail}'...`);
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true
  });

  if (error) {
    console.error("Failed to update email:", error);
  } else {
    console.log("Email updated successfully! Admin can now login using munifrauf2@gmail.com");
  }
})();
