import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { STORAGE_S3_CLIENT } from './storage.constants';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

async function build(storage: Record<string, unknown>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ storage: { r2: storage } })],
      }),
      StorageModule,
    ],
  }).compile();
  return moduleRef;
}

describe('StorageModule', () => {
  it('sem credenciais: cliente nulo e serviço não configurado', async () => {
    const moduleRef = await build({});
    expect(moduleRef.get(STORAGE_S3_CLIENT)).toBeNull();
    expect(moduleRef.get(StorageService).isConfigured()).toBe(false);
  });

  it('com credenciais: cria S3Client apontando para o R2', async () => {
    const moduleRef = await build({
      accountId: 'acc123',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'autopilot-media',
      publicBaseUrl: 'https://media.example.com',
    });
    const client = moduleRef.get<S3Client>(STORAGE_S3_CLIENT);
    expect(client).toBeInstanceOf(S3Client);
    const endpoint = await client.config.endpoint?.();
    expect(endpoint?.hostname).toBe('acc123.r2.cloudflarestorage.com');
    expect(moduleRef.get(StorageService).isConfigured()).toBe(true);
  });
});
