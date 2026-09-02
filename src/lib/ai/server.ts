/**
 * Finora AI Foundation — Server-Only Entrypoint
 * Phase 10 — Server Boundary Enforcement
 *
 * Ensures AI providers and routers are only instantiated on the server side.
 */

import { GeminiProvider } from './providers/gemini';
import { AiRouter } from './router';

if (typeof window !== 'undefined') {
  throw new Error('Finora AI Foundation runtime modules cannot be imported or executed in browser code.');
}

/**
 * Creates a default server-side AI router pre-configured with standard providers.
 */
export function createDefaultServerRouter(): AiRouter {
  const router = new AiRouter();
  router.registerProvider(new GeminiProvider());
  return router;
}
