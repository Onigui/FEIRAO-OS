import { AsyncLocalStorage } from 'async_hooks';

/**
 * 8B — RLS session flags (complement tenant ALS companyId).
 * Bypass is for migrations/seeds/system scanners only.
 */
const rlsBypassAls = new AsyncLocalStorage<boolean>();
const rlsTxDepthAls = new AsyncLocalStorage<number>();
/**
 * Vitrine e Feirões — public read flag (app.public_read).
 * Enables only the SELECT `public_read` RLS policies (published vehicles/fairs).
 * Set exclusively by the showcase module; never together with bypass.
 */
const rlsPublicReadAls = new AsyncLocalStorage<boolean>();

export function isRlsBypass(): boolean {
  return rlsBypassAls.getStore() === true;
}

export function runWithRlsBypass<T>(fn: () => T): T {
  return rlsBypassAls.run(true, fn);
}

export async function runWithRlsBypassAsync<T>(
  fn: () => Promise<T>,
): Promise<T> {
  return rlsBypassAls.run(true, fn);
}

export function getRlsTxDepth(): number {
  return rlsTxDepthAls.getStore() ?? 0;
}

export function runWithRlsTxDepth<T>(depth: number, fn: () => T): T {
  return rlsTxDepthAls.run(depth, fn);
}

export function isRlsPublicRead(): boolean {
  return rlsPublicReadAls.getStore() === true;
}

export function runWithRlsPublicRead<T>(fn: () => T): T {
  return rlsPublicReadAls.run(true, fn);
}

/** Explicitly turns public read off (e.g. tenant writes inside a public request). */
export function runWithoutRlsPublicRead<T>(fn: () => T): T {
  return rlsPublicReadAls.run(false, fn);
}
