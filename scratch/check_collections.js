const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'z:/minlish-backend/.env' });

const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL;

async function run() {
  if (!mongoUri) {
    console.error("No MongoDB URI found.");
    return;
  }
  
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  
  // Count collections
  const collections = ['users', 'posts', 'dailystats', 'userprofiles', 'words', 'vocabularysets'];
  for (const collName of collections) {
    try {
      const count = await mongoose.connection.db.collection(collName).countDocuments();
      console.log(`Collection '${collName}' has: ${count} documents.`);
    } catch (e) {
      console.log(`Collection '${collName}' does not exist or error:`, e.message);
    }
  }
  
  // Get all users
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log("\nUsers in DB:");
  users.forEach(u => console.log(`- ID: ${u._id}, Email: ${u.email}, Name: ${u.name}, Role: ${u.role}`));

  await mongoose.disconnect();
  console.log("\nDisconnected.");
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
