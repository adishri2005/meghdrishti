import { test, expect } from '@playwright/test'

test.describe('Flow 2: Ingestion Simulator, Spike Injection, and Anomaly Drill-Down', () => {
  test('injects cost anomaly from simulator and drills down into root cause', async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/')

    // Navigate to Ingestion
    await page.goto('/ingestion')
    await expect(page.locator('h1')).toContainText('Ingestion')

    // Check pipeline nodes
    await expect(page.getByText('1. API Gateway')).toBeVisible()
    await expect(page.getByText('2. Redis Streams')).toBeVisible()

    // Wait for auth initialization so simulator controls enable
    const executeBtn = page.getByRole('button', { name: 'Execute Simulator Scenario' })
    await expect(executeBtn).toBeEnabled({ timeout: 10000 })

    // Simulator panel: switch to Inject Spike tab
    await page.getByRole('button', { name: /Inject Spike/ }).click()
    await expect(page.getByText('Cost Multiplier')).toBeVisible()

    // Trigger simulation
    await executeBtn.click()

    // Verify Active Watch Mode / Toast notification triggers
    await expect(page.getByText(/Watching stream|scenario queued/i)).toBeVisible({
      timeout: 10000,
    })

    // Navigate to Anomalies page
    await page.goto('/anomalies')
    await expect(page.locator('h1')).toContainText('Anomalies')
    await expect(page.getByText('CRITICAL').first()).toBeVisible()
  })
})
