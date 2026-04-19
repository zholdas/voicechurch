import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return client;
}

export function isR2Configured(): boolean {
  return !!(config.r2.endpoint && config.r2.accessKeyId && config.r2.secretAccessKey);
}

export async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  const s3 = getClient();
  await s3.send(new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
  return key;
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3 = getClient();
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}
