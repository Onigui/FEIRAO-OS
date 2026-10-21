import {
  JWT_DEV_FALLBACK_SECRET,
  JWT_TEST_DEFAULT_SECRET,
  envValidationSchema,
} from './env.validation';

describe('envValidationSchema JWT (P0)', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  };

  it('exige JWT_ACCESS_SECRET em development', () => {
    const { error } = envValidationSchema.validate({
      ...base,
      NODE_ENV: 'development',
    });
    expect(error).toBeDefined();
  });

  it('rejeita fallback inseguro em development', () => {
    const { error } = envValidationSchema.validate({
      ...base,
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: JWT_DEV_FALLBACK_SECRET,
    });
    expect(error).toBeDefined();
  });

  it('aceita secret ≥32 chars em production', () => {
    const { error, value } = envValidationSchema.validate({
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'production-grade-secret-value-32b',
    });
    expect(error).toBeUndefined();
    expect(value.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('usa default de test quando NODE_ENV=test', () => {
    const { error, value } = envValidationSchema.validate({
      ...base,
      NODE_ENV: 'test',
    });
    expect(error).toBeUndefined();
    expect(value.JWT_ACCESS_SECRET).toBe(JWT_TEST_DEFAULT_SECRET);
  });
});

describe('envValidationSchema R2 (Vitrine e Feirões)', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    NODE_ENV: 'test',
  };

  it('aceita ambiente sem R2 (opcional)', () => {
    const { error, value } = envValidationSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value.R2_UPLOAD_URL_TTL_SECONDS).toBe(300);
  });

  it('aceita configuração completa do R2', () => {
    const { error } = envValidationSchema.validate({
      ...base,
      R2_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'autopilot-media',
      R2_PUBLIC_BASE_URL: 'https://media.example.com',
    });
    expect(error).toBeUndefined();
  });

  it('rejeita R2_PUBLIC_BASE_URL relativa', () => {
    const { error } = envValidationSchema.validate({
      ...base,
      R2_PUBLIC_BASE_URL: '/media',
    });
    expect(error).toBeDefined();
  });

  it('rejeita validade de URL assinada fora de 60–3600 s', () => {
    expect(
      envValidationSchema.validate({ ...base, R2_UPLOAD_URL_TTL_SECONDS: 10 })
        .error,
    ).toBeDefined();
    expect(
      envValidationSchema.validate({ ...base, R2_UPLOAD_URL_TTL_SECONDS: 7200 })
        .error,
    ).toBeDefined();
  });
});
