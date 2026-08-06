const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres.cypbnnohtipwavcwukhl:munifpaisedega@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // 1. Clean unsplash photos from photos arrays
  const allJobs = await c.query("SELECT id, photos, notes FROM public.installer_jobs");
  let photosUpdated = 0;
  let notesUpdated = 0;

  for (const row of allJobs.rows) {
    // Clean photos: remove unsplash URLs
    if (Array.isArray(row.photos) && row.photos.length > 0) {
      const cleanPhotos = row.photos.filter(url => 
        url && 
        typeof url === "string" && 
        !url.includes("unsplash.com") && 
        !url.includes("placeholder") &&
        !url.includes("picsum.photos") &&
        url.trim() !== ""
      );
      
      if (cleanPhotos.length !== row.photos.length) {
        await c.query(
          "UPDATE public.installer_jobs SET photos = $1 WHERE id = $2",
          [cleanPhotos, row.id]
        );
        photosUpdated++;
        console.log(`Cleaned photos for job ${row.id}: ${row.photos.length} -> ${cleanPhotos.length}`);
      }
    }

    // Clean notes: remove mixkit/zencdn/gtv video URLs
    if (row.notes && typeof row.notes === "string") {
      let cleanNotes = row.notes;
      // Replace mixkit video URLs with empty
      cleanNotes = cleanNotes.replace(/VIDEO:https?:\/\/[^\s|]*mixkit[^\s|]*/gi, "VIDEO:");
      cleanNotes = cleanNotes.replace(/VIDEO:https?:\/\/[^\s|]*zencdn[^\s|]*/gi, "VIDEO:");
      cleanNotes = cleanNotes.replace(/VIDEO:https?:\/\/[^\s|]*gtv-videos-bucket[^\s|]*/gi, "VIDEO:");
      
      if (cleanNotes !== row.notes) {
        await c.query(
          "UPDATE public.installer_jobs SET notes = $1 WHERE id = $2",
          [cleanNotes, row.id]
        );
        notesUpdated++;
        console.log(`Cleaned notes for job ${row.id}`);
      }
    }
  }

  console.log(`\nDone! Photos cleaned: ${photosUpdated}, Notes cleaned: ${notesUpdated}`);
  
  // Verify
  const verify = await c.query("SELECT id, job_title, photos, notes FROM public.installer_jobs ORDER BY created_at DESC LIMIT 5");
  console.log("\nVERIFICATION:");
  verify.rows.forEach(row => {
    console.log("---");
    console.log("ID:", row.id, "Title:", row.job_title);
    console.log("Photos:", JSON.stringify(row.photos));
    console.log("Notes:", row.notes ? row.notes.substring(0, 200) : "null");
  });

  await c.end();
})();
