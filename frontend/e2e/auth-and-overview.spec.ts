import { test, expect } from '@playwright/test'

test.describe('Flow 1: Authentication, Overview KPIs, and Monitoring Tabs', () => {
  test('logs in, navigates to Overview, and inspects Monitoring hub tabs', async ({ page }) => {
    // 1. Visit root, verify redirect to /login
    await page.goto('/')
    await expect(page).toHaveURL(/.*login/)

    // 2. Fill login form
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // 3. Arrive at Overview
    await page.waitForURL('**/')
    await expect(page.locator('h1')).toContainText('Overview')

    // 4. Verify presence of KPI cards
    await expect(page.getByText('Cost (Last 24h)')).toBeVisible()
    await expect(page.getByText('Open Anomalies')).toBeVisible()

    // 5. Navigate to Monitoring Hub
    await page.goto('/monitoring?tab=overview')
    await expect(page.locator('h1')).toContainText('Monitoring Hub')

    // 6. Switch to Grafana tab
    await page.click('button:has-text("Grafana")')
    await expect(page.getByTitle('CostGuard Grafana Observability Dashboard')).toBeVisible()

    // 7. Switch to Prometheus tab
    await page.click('button:has-text("Prometheus")')
    await expect(page.getByText('PromQL Native Console')).toBeVisible()
  })
})
