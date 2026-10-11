import { test, expect } from '@playwright/test'

test.describe('Flow 1: Authentication, Overview KPIs, and Monitoring Tabs', () => {
  test('logs in, navigates to Overview, and inspects Monitoring hub tabs', async ({ page }) => {
    // 1. Visit /login
    await page.goto('/login')

    // 2. Fill login form
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // 3. Arrive at Overview
    await page.waitForURL('**/')
    await expect(page.locator('h1')).toContainText('Overview')

    // 4. Verify presence of KPI cards
    await expect(page.getByText('Cost (24h)')).toBeVisible()
    await expect(page.getByText('Open Anomalies')).toBeVisible()

    // 5. Navigate to Monitoring Hub
    await page.goto('/monitoring?tab=overview')
    await expect(page.locator('h1')).toContainText('Monitoring Hub')

    // 6. Switch to Grafana tab
    await page.click('main button:has-text("Grafana")')
    await expect(page.getByText('Open Tab')).toBeVisible()

    // 7. Switch to Prometheus tab
    await page.click('main button:has-text("Prometheus")')
    await expect(page.getByText('Native PromQL Console')).toBeVisible()
  })
})
