import 'server-only';

/**
 * Finora AI Foundation — Server-Only Entrypoint
 * Phase 10 — Server Boundary Enforcement
 *
 * Ensures AI providers and routers are only instantiated and executed on the server side.
 * Marked with 'server-only' to guarantee build-time module boundary enforcement.
 */

import { GeminiProvider } from './providers/gemini';
import { AiRouter } from './router';

/**
 * Creates a default server-side AI router pre-configured with standard providers.
 */
export function createDefaultServerRouter(): AiRouter {
  const router = new AiRouter();
  router.registerProvider(new GeminiProvider());
  return router;
}
