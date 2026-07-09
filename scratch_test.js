const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cypbnnohtipwavcwukhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQ3NTMsImV4cCI6MjA5NzIwMDc1M30.WnKhD-jy1likTKYtbdJcJ2JvzSNEPKn9M5U6NbjtCYo'
);

async function check() {
  const { data: stock, error: stockErr } = await supabase.from('stock').select('*');
  const { data: prods, error: prodsErr } = await supabase.from('products').select('*');
  
  console.log("Database Stock Count:", stock ? stock.length : 0);
  console.log("Database Stock Rows:", stock);
  console.log("Database Products Count:", prods ? prods.length : 0);
  console.log("Database Products Rows:", prods);
}
check();
