import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  STORAGE_KEY_PATTERN,
  STORAGE_NOT_CONFIGURED_MESSAGE,
  STORAGE_S3_CLIENT,
} from './storage.constants';

export type CreateUploadUrlInput = {
  /** Object key, e.g. `vehicles/<companyId>/<vehicleId>/<uuid>.jpg`. Built by the caller. */
  key: string;
  contentType: string;
  /** Exact size declared by the client; signed into the URL so R2 rejects a different body size. */
  contentLength: number;
  maxBytes: number;
  allowedContentTypes: readonly string[];
};

export type UploadUrl = {
  method: 'PUT';
  url: string;
  key: string;
  /** Headers the browser must send with the PUT. */
  headers: Record<string, string>;
  expiresAt: Date;
};

/**
 * Vitrine e Feirões — Cloudflare R2 via S3 API.
 * Uploads go browser → R2 with a short-lived presigned PUT; the API never streams file bodies.
 */
@Injectable()
export class StorageService {
  private readonly bucket?: string;
  private readonly publicBaseUrl?: string;
  private readonly uploadUrlTtlSeconds: number;

  constructor(
    config: ConfigService,
    @Optional()
    @Inject(STORAGE_S3_CLIENT)
    private readonly client: S3Client | null = null,
  ) {
    this.bucket = config.get<string>('storage.r2.bucket');
    this.publicBaseUrl = config
      .get<string>('storage.r2.publicBaseUrl')
      ?.replace(/\/+$/, '');
    this.uploadUrlTtlSeconds = config.get<number>(
      'storage.r2.uploadUrlTtlSeconds',
      300,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket && this.publicBaseUrl);
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadUrl> {
    const { client, bucket } = this.requireConfigured();
    this.assertValidKey(input.key);

    if (!input.allowedContentTypes.includes(input.contentType)) {
      throw new BadRequestException('Tipo de arquivo não permitido');
    }
    if (
      !Number.isInteger(input.contentLength) ||
      input.contentLength <= 0 ||
      input.contentLength > input.maxBytes
    ) {
      throw new BadRequestException('Tamanho de arquivo inválido');
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    // Sign type and size so R2 rejects a body that differs from what the API validated.
    const url = await getSignedUrl(client, command, {
      expiresIn: this.uploadUrlTtlSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });

    return {
      method: 'PUT',
      url,
      key: input.key,
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(Date.now() + this.uploadUrlTtlSeconds * 1000),
    };
  }

  publicUrl(key: string): string {
    if (!this.publicBaseUrl) {
      throw new ServiceUnavailableException(STORAGE_NOT_CONFIGURED_MESSAGE);
    }
    this.assertValidKey(key);
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicBaseUrl}/${encoded}`;
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.requireConfigured();
    this.assertValidKey(key);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  private requireConfigured(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket || !this.publicBaseUrl) {
      throw new ServiceUnavailableException(STORAGE_NOT_CONFIGURED_MESSAGE);
    }
    return { client: this.client, bucket: this.bucket };
  }

  private assertValidKey(key: string): void {
    if (
      !STORAGE_KEY_PATTERN.test(key) ||
      key.includes('..') ||
      key.includes('//')
    ) {
      throw new BadRequestException('Chave de arquivo inválida');
    }
  }
}
