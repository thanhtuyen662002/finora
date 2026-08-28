/**
 * Utility for sanitizing and validating redirect URLs to prevent open-redirect vulnerabilities.
 */

/**
 * Validates that a given target URL is a safe, relative application path.
 * Rejects absolute URLs, protocol-relative URLs (//), URLs with backslashes,
 * or strings with control characters.
 *
 * @param target The target path to validate
 * @param fallback The fallback path if validation fails (defaults to '/dashboard')
 * @returns A safe relative application path
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Must start with a single slash and not double slash or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Reject control characters or newlines
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return fallback;
  }

  // Reject backslashes anywhere in the path to prevent browser path normalization tricks
  if (trimmed.includes('\\')) {
    return fallback;
  }

  try {
    // Validate by parsing relative to a dummy origin
    const dummyOrigin = 'http://localhost';
    const parsed = new URL(trimmed, dummyOrigin);

    // The origin must remain exactly the dummy origin (i.e. no host switching)
    if (parsed.origin !== dummyOrigin) {
      return fallback;
    }

    // Return the safe relative pathname + search + hash
    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!safePath.startsWith('/') || safePath.startsWith('//')) {
      return fallback;
    }

    return safePath;
  } catch {
    return fallback;
  }
}
