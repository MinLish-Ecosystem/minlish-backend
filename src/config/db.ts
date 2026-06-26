import mongoose from "mongoose";
import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config();

// Set DNS tường minh — giống hệt pattern đã hoạt động trong project cũ
// try {
//   dns.setServers(["1.1.1.1", "8.8.8.8"]);
//   console.log("✓ Custom DNS servers set successfully.");
// } catch (err: any) {
//   console.error("⚠ Could not set custom DNS servers:", err.message);
// }

/**
 * Kết nối MongoDB
 * Đọc từ MONGO_URI trong .env (hỗ trợ cả Atlas và Local)
 */
export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL;

  if (!mongoUri) {
    console.error("✗ Fatal Error: MONGO_URI_ATLAS and MONGO_URI_LOCAL are not defined in .env");
    process.exit(1);
  }

  const isAtlas = mongoUri.includes("mongodb+srv");
  const connType = isAtlas ? "MongoDB Atlas (Cloud)" : "MongoDB Local";

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 50,          // Default là 5 — tránh bottleneck kết nối dưới tải cao
      minPoolSize: 10,          // Duy trì sẵn 10 kết nối để tránh tình trạng cold start
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(
      `✓ Connection to ${connType} has been established successfully.`,
    );
    console.log(`Database: ${mongoose.connection.name}`);
  } catch (error: any) {
    console.error("✗ Unable to connect to the database:", error.message);
    if (!process.env.MONGO_URI) {
      console.error("\n⚠ Tip: Using local MongoDB. To use MongoDB Atlas:");
      console.error("1. Get connection string from MongoDB Atlas");
      console.error("2. Add MONGO_URI=mongodb+srv://... to .env file");
      console.error("3. Restart the application\n");
    }
    throw error;
  }
};
