import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/styles/globals.css'
import { applyThemeToDocument, useUIStore } from './store/ui'

async function prepareApp() {
  // Apply saved theme immediately before hydration to prevent flash
  applyThemeToDocument(useUIStore.getState().theme)

  if (import.meta.env.VITE_MOCK === 'true') {
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
