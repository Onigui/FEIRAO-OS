import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { STORAGE_S3_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

/**
 * Vitrine e Feirões — file storage (Cloudflare R2).
 * No controller: feature modules (inventory, fairs) expose their own upload endpoints.
 */
@Module({
  providers: [
    {
      provide: STORAGE_S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client | null => {
        const accountId = config.get<string>('storage.r2.accountId');
        const accessKeyId = config.get<string>('storage.r2.accessKeyId');
        const secretAccessKey = config.get<string>(
          'storage.r2.secretAccessKey',
        );
        const customEndpoint = config.get<string>('storage.r2.endpoint');
        if (
          !accessKeyId ||
          !secretAccessKey ||
          (!accountId && !customEndpoint)
        ) {
          return null;
        }
        return new S3Client({
          region: 'auto',
          endpoint:
            customEndpoint ?? `https://${accountId}.r2.cloudflarestorage.com`,
          // MinIO e outros compatíveis usam URL com o bucket no caminho.
          forcePathStyle: Boolean(customEndpoint),
          credentials: { accessKeyId, secretAccessKey },
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
