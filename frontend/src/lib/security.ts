/**
 * Client-side security utilities:
 * - URL & redirect sanitization (OWASP A01 / Open Redirect defense)
 * - Safe protocol validation
 */

/**
 * Validate and sanitize redirect target URLs to prevent Open Redirect vulnerabilities.
 * Ensures the destination is strictly a relative same-origin path starting with a single '/'
 * and rejects protocol-relative ('//'), backslash ('\'), or scheme-prefixed URLs.
 */
export function sanitizeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target || typeof target !== 'string') {
    return fallback
  }

  const trimmed = target.trim()

  // Prevent protocol-relative URLs (e.g. //evil.com)
  if (trimmed.startsWith('//')) {
    return fallback
  }

  // Prevent backslash evasion (e.g. /\evil.com or \evil.com)
  if (trimmed.includes('\\')) {
    return fallback
  }

  // Prevent absolute URLs (e.g. https://evil.com, javascript:, data:)
  if (trimmed.includes('://') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback
  }

  // Must begin with a single slash
  if (!trimmed.startsWith('/')) {
    return fallback
  }

  return trimmed
}

/**
 * Check whether an external URL is safe to open (restricting to http: and https: schemes).
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
