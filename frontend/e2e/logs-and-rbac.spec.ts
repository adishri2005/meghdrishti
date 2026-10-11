import { test, expect } from '@playwright/test'

test.describe('Flow 3: Application Logs Viewer and Role-Based Access Control', () => {
  test('admin views live application logs and tail controls', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/')

    // Navigate to App Logs
    await page.goto('/logs/app')
    await expect(page.locator('h1')).toContainText('Application Logs')

    // Check Live stream indicators
    await expect(page.getByText(/Live SSE Connected|Polling Fallback/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Pause Stream/i })).toBeVisible()

    // Filter by level
    await page.click('button:has-text("ERROR")')
    await expect(page.getByText('ERROR')).first().toBeVisible()
  })

  test('analyst user is restricted from admin settings and logs', async ({ page }) => {
    // Login as analyst
    await page.goto('/login')
    await page.fill('input[type="text"]', 'analyst')
    await page.fill('input[type="password"]', 'analyst123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/')

    // Analyst attempts to open settings users tab
    await page.goto('/settings')
    await page.click('button:has-text("User Accounts")')
    await expect(page.getByText('Administrator Privileges Required')).toBeVisible()
  })
})
