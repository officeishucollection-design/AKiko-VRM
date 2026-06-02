import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Override default system DNS resolver with fast public DNS to bypass local router lookup timeouts (disabled on Vercel)
if (!process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('DNS resolvers overridden with Google and Cloudflare DNS to ensure fast MongoDB Atlas lookups.');
  } catch (dnsErr) {
    console.warn('Unable to override DNS servers:', dnsErr.message);
  }
}

const connectDB = async () => {
  // If already connected, reuse
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If currently connecting, wait for it to complete
  if (mongoose.connection.readyState === 2) {
    console.log('MongoDB connection in progress (readyState: 2). Waiting for active handshaking...');
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(interval);
          resolve(mongoose.connection);
        } else if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
          clearInterval(interval);
          reject(new Error('MongoDB connection failed during handshaking.'));
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('MongoDB connection handshaking timed out (8s limit).'));
      }, 8000);
    });
  }

  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vrm';
    console.log(`Initiating connection to MongoDB at: ${connUri.replace(/:([^@]+)@/, ':****@')}`);
    
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 8000 // fail fast if network/IP is blocked
    });
    console.log('MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('CRITICAL: MongoDB Connection Failed:', error);
    throw error;
  }
};

export default connectDB;
