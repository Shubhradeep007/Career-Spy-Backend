require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  const db = mongoose.connection.db;
  const collection = db.collection("resumes");
  
  try {
    const indexes = await collection.indexes();
    console.log("Current indexes on resumes:", indexes);
    
    // Check if unique index userId_1 exists
    const hasUserIdUniqueIndex = indexes.some(idx => idx.name === "userId_1" && idx.unique === true);
    if (hasUserIdUniqueIndex) {
      console.log("Dropping unique index userId_1...");
      await collection.dropIndex("userId_1");
      console.log("Successfully dropped unique index userId_1!");
    } else {
      console.log("Unique index userId_1 not found (or already dropped).");
    }
    
    // Update all existing resumes to set isActive: true, fileName: "Resume.pdf" if they don't have them
    console.log("Updating existing resumes with default active state and file name...");
    const updateResult = await collection.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true, fileName: "My Resume.pdf" } }
    );
    console.log(`Updated ${updateResult.modifiedCount} resumes.`);
    
    // Also ensure fileName exists for any resume that doesn't have it
    const updateNameResult = await collection.updateMany(
      { fileName: { $exists: false } },
      { $set: { fileName: "My Resume.pdf" } }
    );
    console.log(`Updated fileNames for ${updateNameResult.modifiedCount} resumes.`);

    const newIndexes = await collection.indexes();
    console.log("New indexes on resumes:", newIndexes);
  } catch (error) {
    console.error("Migration error:", error);
  }
  
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB. Migration completed!");
}

run().catch(console.error);
