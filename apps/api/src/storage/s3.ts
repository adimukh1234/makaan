import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { EvidenceStore, StoredObject } from './types';

export class S3EvidenceStore implements EvidenceStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return {
        data: Buffer.from(bytes),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error) {
        const name = (error as { name?: string }).name;
        if (name === 'NoSuchKey' || name === 'NotFound') return null;
      }
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
