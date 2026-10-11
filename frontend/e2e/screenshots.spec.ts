import { test } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const screenshotsDir = path.resolve(__dirname, '../../docs/screenshots')

test.describe('Automated Documentation Screenshots', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
  })

  const pages = [
    { name: '01_login', path: '/login', requiresAuth: false },
    { name: '02_overview', path: '/', requiresAuth: true },
    { name: '03_anomalies', path: '/anomalies', requiresAuth: true },
    { name: '04_costs', path: '/costs', requiresAuth: true },
    { name: '05_resources', path: '/resources', requiresAuth: true },
    { name: '06_ingestion', path: '/ingestion', requiresAuth: true },
    { name: '07_monitoring_overview', path: '/monitoring?tab=overview', requiresAuth: true },
    { name: '08_monitoring_prometheus', path: '/monitoring?tab=prometheus', requiresAuth: true },
    { name: '09_logs_application', path: '/logs/app', requiresAuth: true },
    { name: '10_logs_audit', path: '/logs/audit', requiresAuth: true },
    { name: '11_deployments', path: '/deployments', requiresAuth: true },
    { name: '12_settings', path: '/settings', requiresAuth: true },
  ]

  for (const p of pages) {
    test(`capture ${p.name} (dark & light)`, async ({ page }) => {
      // 1. Authenticate if required
      if (p.requiresAuth) {
        await page.goto('/login')
        await page.fill('input[type="text"]', 'admin')
        await page.fill('input[type="password"]', 'admin123')
        await page.click('button[type="submit"]')
        await page.waitForURL('**/')
      }

      await page.goto(p.path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Capture dark theme
      await page.screenshot({
        path: path.join(screenshotsDir, `${p.name}_dark.png`),
        fullPage: true,
      })

      // Toggle to light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
      })
      await page.waitForTimeout(500)

      // Capture light theme
      await page.screenshot({
        path: path.join(screenshotsDir, `${p.name}_light.png`),
        fullPage: true,
      })
    })
  }
})
