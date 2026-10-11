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
    await expect(page.getByText('FastAPI Gateway')).toBeVisible()
    await expect(page.getByText('Redis Streams')).toBeVisible()

    // Simulator panel: switch to Inject Spike tab
    await page.click('button:has-text("Inject Spike")')
    await expect(page.getByText('Multiplier (relative spike)')).toBeVisible()

    // Trigger simulation
    await page.click('button:has-text("Simulate Cost Spike")')

    // Verify Active Watch Mode / Toast notification triggers
    await expect(page.getByText(/Anomaly Detection Watch Active|Simulation Triggered/i)).toBeVisible({
      timeout: 10000,
    })

    // Navigate to Anomalies page
    await page.goto('/anomalies')
    await expect(page.locator('h1')).toContainText('Anomalies')
    await expect(page.getByText('CRITICAL')).first().toBeVisible()
  })
})
