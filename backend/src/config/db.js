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
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vrm';
    console.log(`Connecting to MongoDB at: ${connUri.replace(/:([^@]+)@/, ':****@')}`);
    
    await mongoose.connect(connUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.log('Warning: Backend will run, but database features require a running MongoDB instance.');
  }
};

export default connectDB;
