import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const isAwsConfigured = () => {
  return (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_ACCESS_KEY_ID !== 'your_access_key' &&
    process.env.AWS_ACCESS_KEY_ID !== 'mock' &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_SECRET_ACCESS_KEY !== 'your_secret_key' &&
    process.env.AWS_SECRET_ACCESS_KEY !== 'mock' &&
    process.env.AWS_S3_BUCKET_NAME &&
    process.env.AWS_S3_BUCKET_NAME !== 'your_s3_bucket_name' &&
    process.env.AWS_S3_BUCKET_NAME !== 'mock'
  );
};

let s3Client = null;

if (isAwsConfigured()) {
  console.log('AWS S3 initialized successfully');
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
} else {
  console.warn('AWS credentials not fully configured. Using LOCAL MOCK STORAGE fallback.');
}

/**
 * Generate a presigned upload URL for S3 or a local mock URL
 * @param {string} key - S3 object key (e.g. "videos/awb-123.webm")
 * @param {string} contentType - mime type of the file
 * @returns {Promise<{uploadUrl: string, fileUrl: string, isMock: boolean}>}
 */
export const getUploadPresignedUrl = async (key, contentType) => {
  if (s3Client) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });
    
    // URL expires in 15 minutes (900 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    
    return { uploadUrl, fileUrl, isMock: false };
  } else {
    // Return mock endpoints for local uploading
    const localPort = process.env.PORT || 5000;
    const cleanKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // sanitize
    const uploadUrl = `http://localhost:${localPort}/api/records/mock-upload?key=${cleanKey}`;
    const fileUrl = `http://localhost:${localPort}/uploads/${cleanKey}`;
    
    return { uploadUrl, fileUrl, isMock: true };
  }
};

/**
 * Delete an object from S3
 * @param {string} fileUrl - The URL of the file stored in S3
 * @returns {Promise<boolean>}
 */
export const deleteFromS3 = async (fileUrl) => {
  if (!s3Client) {
    console.log('Mock S3 Delete: File deleted locally (will be deleted from file system).');
    return true;
  }
  
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    
    // Parse key out of URL: https://bucket.s3.region.amazonaws.com/key
    const bucketUrlPrefix = `https://${bucketName}.s3.`;
    if (!fileUrl.startsWith(bucketUrlPrefix)) {
      throw new Error('File URL does not match S3 bucket URL structure.');
    }
    
    // Find the slash after amazonaws.com
    const domainMatchEnd = fileUrl.indexOf('.amazonaws.com/');
    if (domainMatchEnd === -1) {
      throw new Error('Invalid S3 URL format.');
    }
    
    const key = decodeURIComponent(fileUrl.substring(domainMatchEnd + 15));
    
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    await s3Client.send(command);
    console.log(`Successfully deleted ${key} from S3`);
    return true;
  } catch (error) {
    console.error(`S3 Delete error: ${error.message}`);
    return false;
  }
};
