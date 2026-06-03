/**
 * True when Node is running the production build (`next start` / deployed).
 */
export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}
