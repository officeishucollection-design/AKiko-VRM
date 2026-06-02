import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import connectDB from './config/db.js';
import Record from './models/Record.js';
import { getUploadPresignedUrl, deleteFromS3 } from './services/s3.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize folders (use writeable /tmp directory when running in Vercel serverless context)
const uploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');

const orderDir = path.join(uploadsDir, 'order');
const returnDir = path.join(uploadsDir, 'return');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(orderDir)) {
  fs.mkdirSync(orderDir, { recursive: true });
}
if (!fs.existsSync(returnDir)) {
  fs.mkdirSync(returnDir, { recursive: true });
}

const localDbPath = process.env.VERCEL
  ? path.join('/tmp', 'local_db.json')
  : path.join(__dirname, '..', 'local_db.json');

if (!fs.existsSync(localDbPath)) {
  fs.writeFileSync(localDbPath, JSON.stringify([], null, 2));
}

// Helper to write to JSON db fallback
const readLocalDb = () => {
  try {
    const data = fs.readFileSync(localDbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeLocalDb = (records) => {
  fs.writeFileSync(localDbPath, JSON.stringify(records, null, 2));
};

const app = express();

app.use(cors());
app.use(express.json());

// Serve static mock uploads
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
connectDB();

// 1. Get Presigned URL for Upload
app.post('/api/records/presigned-url', async (req, res) => {
  try {
    const { awb, contentType } = req.body;
    if (!awb) {
      return res.status(400).json({ error: 'AWB number is required' });
    }

    const cleanAwb = awb.trim();
    
    // Check if AWB already exists in MongoDB
    let exists = false;
    try {
      if (Record.db.readyState === 1) {
        const record = await Record.findOne({ awb: cleanAwb });
        exists = !!record;
      } else {
        const records = readLocalDb();
        exists = records.some(r => r.awb.toLowerCase() === cleanAwb.toLowerCase());
      }
    } catch (e) {
      const records = readLocalDb();
      exists = records.some(r => r.awb.toLowerCase() === cleanAwb.toLowerCase());
    }

    if (exists) {
      return res.status(400).json({ error: `AWB ${cleanAwb} already has a recording.` });
    }

    const { type, fileType, fileIndex } = req.body;
    const extMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'video/webm': 'webm',
      'video/mp4': 'mp4'
    };
    const extension = extMap[contentType] || contentType.split('/')[1] || 'webm';
    
    let key;
    if (type === 'return') {
      if (fileType === 'photo') {
        key = `return/${cleanAwb}/photo_${Date.now()}_${fileIndex || 0}.${extension}`;
      } else {
        key = `return/${cleanAwb}/video_${Date.now()}.${extension}`;
      }
    } else {
      key = `order/${Date.now()}_${cleanAwb}.${extension}`;
    }
    
    const urlDetails = await getUploadPresignedUrl(key, contentType);
    
    res.json({
      awb: cleanAwb,
      ...urlDetails
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload target URL' });
  }
});

// 2. Save Metadata after upload
app.post('/api/records', async (req, res) => {
  try {
    const { awb, videoUrl, photos, duration, isMock, type } = req.body;
    
    if (!awb) {
      return res.status(400).json({ error: 'AWB is required' });
    }

    const recordData = {
      awb: awb.trim(),
      videoUrl: videoUrl || null,
      photos: photos || [],
      duration: duration || 0,
      type: type || 'order',
      recordedAt: new Date(),
      isMock: !!isMock
    };

    let newRecord;
    let databaseSaved = false;

    // Try MongoDB
    try {
      if (Record.db.readyState === 1) {
        newRecord = await Record.create(recordData);
        databaseSaved = true;
        console.log(`Saved record for AWB ${recordData.awb} to MongoDB.`);
      }
    } catch (dbError) {
      console.warn('Could not write to MongoDB, falling back to local database file.', dbError.message);
    }

    // JSON fallback
    if (!databaseSaved) {
      const records = readLocalDb();
      // Remove any existing duplicate just in case
      const filtered = records.filter(r => r.awb.toLowerCase() !== recordData.awb.toLowerCase());
      filtered.push(recordData);
      writeLocalDb(filtered);
      newRecord = recordData;
      console.log(`Saved record for AWB ${recordData.awb} to local JSON DB.`);
    }

    res.status(201).json({ success: true, record: newRecord });
  } catch (error) {
    console.error('Error saving record:', error);
    res.status(500).json({ error: 'Failed to save record metadata' });
  }
});

// 3. Get Records with Search and Filters
app.get('/api/records', async (req, res) => {
  try {
    const { search, sortBy, limit } = req.query;
    
    let records = [];
    let isDbOnline = false;

    // Attempt Mongo first
    try {
      if (Record.db.readyState === 1) {
        isDbOnline = true;
        let query = {};
        if (search) {
          query.awb = { $regex: search.trim(), $options: 'i' };
        }
        
        let sortOption = { recordedAt: -1 }; // default
        if (sortBy === 'date-asc') {
          sortOption = { recordedAt: 1 };
        } else if (sortBy === 'awb-asc') {
          sortOption = { awb: 1 };
        } else if (sortBy === 'awb-desc') {
          sortOption = { awb: -1 };
        } else if (sortBy === 'duration-desc') {
          sortOption = { duration: -1 };
        } else if (sortBy === 'duration-asc') {
          sortOption = { duration: 1 };
        }

        records = await Record.find(query)
          .sort(sortOption)
          .limit(limit ? parseInt(limit) : 100);
      }
    } catch (e) {
      console.warn('Database offline, reading local JSON DB for fetch.');
    }

    // Local JSON fallback
    if (!isDbOnline) {
      records = readLocalDb();
      
      // Filter search
      if (search) {
        const queryTerm = search.trim().toLowerCase();
        records = records.filter(r => r.awb.toLowerCase().includes(queryTerm));
      }
      
      // Sort records
      records.sort((a, b) => {
        const dateA = new Date(a.recordedAt);
        const dateB = new Date(b.recordedAt);
        
        if (sortBy === 'date-asc') {
          return dateA - dateB;
        } else if (sortBy === 'awb-asc') {
          return a.awb.localeCompare(b.awb);
        } else if (sortBy === 'awb-desc') {
          return b.awb.localeCompare(a.awb);
        } else if (sortBy === 'duration-desc') {
          return b.duration - a.duration;
        } else if (sortBy === 'duration-asc') {
          return a.duration - b.duration;
        } else {
          // date-desc (default)
          return dateB - dateA;
        }
      });

      if (limit) {
        records = records.slice(0, parseInt(limit));
      }
    }

    res.json(records);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ error: 'Failed to fetch records list' });
  }
});

// 4. Delete Record
app.delete('/api/records/:awb', async (req, res) => {
  try {
    const awbParam = req.params.awb;
    
    let deleted = false;
    let recordToDelete = null;

    // MongoDB
    try {
      if (Record.db.readyState === 1) {
        recordToDelete = await Record.findOne({ awb: awbParam });
        if (recordToDelete) {
          // Delete from S3/Local S3 wrapper
          await deleteFromS3(recordToDelete.videoUrl);
          
          // If it was mock local storage, delete the file from the local disk
          if (recordToDelete.isMock) {
            if (recordToDelete.type === 'return') {
              const localFolderPath = path.join(uploadsDir, 'return', recordToDelete.awb);
              if (fs.existsSync(localFolderPath)) {
                fs.rmSync(localFolderPath, { recursive: true, force: true });
              }
            } else {
              const fileName = path.basename(recordToDelete.videoUrl);
              const localFilePath = recordToDelete.videoUrl.includes('/order/')
                ? path.join(uploadsDir, 'order', fileName)
                : path.join(uploadsDir, fileName);
              if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
              }
            }
          }

          await Record.deleteOne({ awb: awbParam });
          deleted = true;
        }
      }
    } catch (e) {
      console.warn('MongoDB offline during delete, falling back to local JSON DB');
    }

    // JSON DB fallback
    if (!deleted) {
      const records = readLocalDb();
      recordToDelete = records.find(r => r.awb.toLowerCase() === awbParam.toLowerCase());
      
      if (recordToDelete) {
        // Delete mock local upload
        if (recordToDelete.isMock) {
          if (recordToDelete.type === 'return') {
            const localFolderPath = path.join(uploadsDir, 'return', recordToDelete.awb);
            if (fs.existsSync(localFolderPath)) {
              fs.rmSync(localFolderPath, { recursive: true, force: true });
            }
          } else {
            const fileName = path.basename(recordToDelete.videoUrl);
            const localFilePath = recordToDelete.videoUrl.includes('/order/')
              ? path.join(uploadsDir, 'order', fileName)
              : path.join(uploadsDir, fileName);
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
            }
          }
        }

        const filtered = records.filter(r => r.awb.toLowerCase() !== awbParam.toLowerCase());
        writeLocalDb(filtered);
        deleted = true;
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ success: true, message: `Successfully deleted AWB ${awbParam}` });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// 5. Mock Upload Route (Accepts direct binary upload for testing)
app.post('/api/records/mock-upload', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  // Sanitize key filename and handle subfolders
  let filePath;
  if (key.startsWith('return/')) {
    const keyParts = key.split('/');
    const awbSubfolder = keyParts[1];
    const filename = keyParts[2].replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const destFolder = path.join(uploadsDir, 'return', awbSubfolder);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    filePath = path.join(destFolder, filename);
  } else if (key.startsWith('order/')) {
    const filename = key.substring(6).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    filePath = path.join(uploadsDir, 'order', filename);
  } else {
    const filename = key.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    filePath = path.join(uploadsDir, filename);
  }
  
  console.log(`Mock Uploading: Writing binary stream to ${filePath}`);
  const writeStream = fs.createWriteStream(filePath);
  
  req.pipe(writeStream);
  
  req.on('end', () => {
    console.log(`Mock Upload Complete: Successfully stored ${path.basename(filePath)}`);
    const relativeUrl = key.startsWith('return/')
      ? `/uploads/return/${key.split('/')[1]}/${path.basename(filePath)}`
      : key.startsWith('order/')
        ? `/uploads/order/${path.basename(filePath)}`
        : `/uploads/${path.basename(filePath)}`;
    res.json({ success: true, url: relativeUrl });
  });

  writeStream.on('error', (err) => {
    console.error(`Mock upload write stream error: ${err.message}`);
    res.status(500).json({ error: 'Failed to save mock video upload' });
  });
});

// 6. Proxy Route to bypass CORS when downloading external media files
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Basic validation to check if it's a valid http or https URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL scheme' });
    }

    console.log(`Proxying download request for URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch target URL: ${response.statusText}` });
    }

    // Forward headers if present
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.status(500).json({ error: 'Response body is empty' });
    }
  } catch (error) {
    console.error('Error in proxy endpoint:', error);
    res.status(500).json({ error: 'Proxy request failed: ' + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`VRM Express Backend running on http://localhost:${PORT}`);
});
