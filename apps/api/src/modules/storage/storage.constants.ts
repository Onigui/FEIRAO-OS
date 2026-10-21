/** DI token for the S3-compatible client (Cloudflare R2). `null` when R2 is not configured. */
export const STORAGE_S3_CLIENT = Symbol('STORAGE_S3_CLIENT');

/** Object keys: relative path, no traversal, no leading slash, conservative charset. */
export const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,299}$/;

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  'Armazenamento de arquivos não configurado';
