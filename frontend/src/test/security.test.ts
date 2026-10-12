import { describe, it, expect } from 'vitest'
import { sanitizeRedirect, isSafeUrl } from '@/lib/security'

describe('sanitizeRedirect (Open Redirect Defense)', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeRedirect('/anomalies')).toBe('/anomalies')
    expect(sanitizeRedirect('/resources/123?tab=costs')).toBe('/resources/123?tab=costs')
    expect(sanitizeRedirect('/settings#api-keys')).toBe('/settings#api-keys')
  })

  it('rejects external absolute URLs', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/')
    expect(sanitizeRedirect('http://malicious.org/phish')).toBe('/')
    expect(sanitizeRedirect('ftp://files.org')).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/')
    expect(sanitizeRedirect('//attacker.org/steal')).toBe('/')
  })

  it('rejects backslash evasion techniques', () => {
    expect(sanitizeRedirect('/\\evil.com')).toBe('/')
    expect(sanitizeRedirect('\\evil.com')).toBe('/')
    expect(sanitizeRedirect('/path\\extra')).toBe('/')
  })

  it('rejects javascript: and data: URI schemes', () => {
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/')
    expect(sanitizeRedirect('data:text/html,<script>evil()</script>')).toBe('/')
  })

  it('falls back safely for null, undefined, and empty string', () => {
    expect(sanitizeRedirect(null)).toBe('/')
    expect(sanitizeRedirect(undefined)).toBe('/')
    expect(sanitizeRedirect('')).toBe('/')
    expect(sanitizeRedirect(null, '/overview')).toBe('/overview')
  })
})

describe('isSafeUrl', () => {
  it('validates http and https protocols', () => {
    expect(isSafeUrl('https://grafana.example.com')).toBe(true)
    expect(isSafeUrl('http://localhost:9090')).toBe(true)
  })

  it('rejects javascript and unknown schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
  })
})
