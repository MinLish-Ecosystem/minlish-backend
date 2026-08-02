import mongoose from "mongoose";
import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config();

// Set DNS
try {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
  console.log("✓ Custom DNS servers set successfully.");
} catch (err: any) {
  console.error("⚠ Could not set custom DNS servers:", err.message);
}

// Connection options
const connectionOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
};

// Try to connect to a MongoDB URI
const tryConnect = async (uri: string, name: string): Promise<boolean> => {
  try {
    await mongoose.connect(uri, connectionOptions);
    console.log(`✓ Connected to ${name}`);
    console.log(`Database: ${mongoose.connection.name}`);
    return true;
  } catch (error: any) {
    console.error(`✗ Failed to connect to ${name}:`, error.message);
    return false;
  }
};

export const connectDB = async (): Promise<void> => {
  const atlasUri = process.env.MONGO_URI_ATLAS;
  const localUri = process.env.MONGO_URI_LOCAL || "mongodb://localhost:27017/minlish";

  // If no Atlas URI, use local directly
  if (!atlasUri) {
    console.warn("⚠ MONGO_URI_ATLAS not set, using local MongoDB...");
    const success = await tryConnect(localUri, "MongoDB Local");
    if (!success) {
      console.error("✗ Fatal: Cannot connect to local MongoDB");
      process.exit(1);
    }
    return;
  }

  // Try Atlas first
  console.log("🔄 Attempting to connect to MongoDB Atlas...");
  let success = await tryConnect(atlasUri, "MongoDB Atlas");

  if (success) {
    return;
  }

  // Fallback to Local
  console.warn("⚠ Atlas connection failed, falling back to local MongoDB...");
  success = await tryConnect(localUri, "MongoDB Local");

  if (!success) {
    console.error("✗ Fatal: Cannot connect to any MongoDB");
    console.error("Please check:");
    console.error("1. MongoDB Atlas credentials in .env");
    console.error("2. Local MongoDB is running");
    console.error("3. Network connection");
    process.exit(1);
  }
};
