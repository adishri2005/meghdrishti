import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/styles/globals.css'
import '@/styles/tour.css'
import { applyThemeToDocument, useUIStore } from './store/ui'

async function prepareApp() {
  // Apply saved theme immediately before hydration to prevent flash
  applyThemeToDocument(useUIStore.getState().theme)

  if (import.meta.env.VITE_MOCK === 'true') {
    // Seed dev session cookie for embedded telemetry gateways (Grafana / Prometheus)
    if (typeof document !== 'undefined') {
      if (!document.cookie.includes('meghdrishti_token=')) {
        document.cookie =
          'meghdrishti_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM; path=/; max-age=86400; SameSite=Lax'
      }
      if (!document.cookie.includes('ccad_token=')) {
        document.cookie =
          'ccad_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM; path=/; max-age=86400; SameSite=Lax'
      }
    }
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
  }
}

prepareApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
