const mongoose = require('mongoose');

let mongoServer = null;

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      // Automatic fallback to embedded MongoDB memory server for instant zero-config launch!
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        console.log(`[DB] Using embedded MongoDB instance: ${mongoUri}`);
      } catch (err) {
        console.warn(`[DB] MongoMemoryServer notice: falling back to localhost`);
        mongoUri = 'mongodb://127.0.0.1:27017/rescueflow';
      }
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[DB Error] ${error.message}`);
    process.exit(1);
  }
};

const closeDB = async () => {
  if (mongoose.connection) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = { connectDB, closeDB };
