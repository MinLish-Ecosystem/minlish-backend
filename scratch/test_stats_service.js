const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'z:/minlish-backend/.env' });

const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL;

const { getDashboardStats } = require('../dist/services/stats.service');

async function run() {
  if (!mongoUri) {
    console.error("No MongoDB URI found.");
    return;
  }
  
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  
  // Try running the service method for User Test9
  const userId = "69fca3f90f60baf0664cd16a";
  try {
    const stats = await getDashboardStats(userId);
    console.log("Stats Fetched successfully:", stats);
  } catch (err) {
    console.error("Error in getDashboardStats:", err);
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
