import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in values ? values[key] : fallback,
    ),
  } as unknown as ConfigService;
}

const configured = {
  'storage.r2.bucket': 'autopilot-media',
  'storage.r2.publicBaseUrl': 'https://media.example.com/',
  'storage.r2.uploadUrlTtlSeconds': 300,
};

describe('StorageService', () => {
  let send: jest.Mock;
  let client: S3Client;

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    client = { send } as unknown as S3Client;
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue('https://signed.example/put');
  });

  describe('when R2 is not configured', () => {
    const service = new StorageService(makeConfig({}), null);

    it('reports not configured', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('createUploadUrl → 503', async () => {
      await expect(
        service.createUploadUrl({
          key: 'vehicles/c/v/a.jpg',
          contentType: 'image/jpeg',
          contentLength: 10,
          maxBytes: 100,
          allowedContentTypes: IMAGE_TYPES,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('deleteObject → 503', async () => {
      await expect(service.deleteObject('a/b.jpg')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('publicUrl → 503', () => {
      expect(() => service.publicUrl('a/b.jpg')).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('when R2 is configured', () => {
    let service: StorageService;

    beforeEach(() => {
      service = new StorageService(makeConfig(configured), client);
    });

    it('reports configured', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('signs a PUT with content type and length', async () => {
      const result = await service.createUploadUrl({
        key: 'vehicles/c1/v1/photo.jpg',
        contentType: 'image/jpeg',
        contentLength: 1234,
        maxBytes: 8 * 1024 * 1024,
        allowedContentTypes: IMAGE_TYPES,
      });

      expect(result.method).toBe('PUT');
      expect(result.url).toBe('https://signed.example/put');
      expect(result.key).toBe('vehicles/c1/v1/photo.jpg');
      expect(result.headers).toEqual({ 'Content-Type': 'image/jpeg' });
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const [usedClient, command, options] = getSignedUrlMock.mock.calls[0];
      expect(usedClient).toBe(client);
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toEqual({
        Bucket: 'autopilot-media',
        Key: 'vehicles/c1/v1/photo.jpg',
        ContentType: 'image/jpeg',
        ContentLength: 1234,
      });
      expect(options?.expiresIn).toBe(300);
      expect(options?.signableHeaders).toEqual(
        new Set(['content-type', 'content-length']),
      );
    });

    it('rejects a content type outside the allowed list', async () => {
      await expect(
        service.createUploadUrl({
          key: 'vehicles/c1/v1/a.gif',
          contentType: 'image/gif',
          contentLength: 10,
          maxBytes: 100,
          allowedContentTypes: IMAGE_TYPES,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, 101])(
      'rejects invalid size %p',
      async (contentLength) => {
        await expect(
          service.createUploadUrl({
            key: 'vehicles/c1/v1/a.jpg',
            contentType: 'image/jpeg',
            contentLength,
            maxBytes: 100,
            allowedContentTypes: IMAGE_TYPES,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each([
      '../secret.jpg',
      '/vehicles/a.jpg',
      'vehicles//a.jpg',
      'vehicles/../a.jpg',
      'vehicles/a b.jpg',
      '',
    ])('rejects unsafe key %p', async (key) => {
      await expect(
        service.createUploadUrl({
          key,
          contentType: 'image/jpeg',
          contentLength: 10,
          maxBytes: 100,
          allowedContentTypes: IMAGE_TYPES,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('builds the public URL without double slashes', () => {
      expect(service.publicUrl('vehicles/c1/v1/photo.jpg')).toBe(
        'https://media.example.com/vehicles/c1/v1/photo.jpg',
      );
    });

    it('deletes an object', async () => {
      await service.deleteObject('vehicles/c1/v1/photo.jpg');
      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'autopilot-media',
        Key: 'vehicles/c1/v1/photo.jpg',
      });
    });
  });
});
