import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { router } from './router'
import { useUIStore, applyThemeToDocument } from './store/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        theme={theme === 'light' ? 'light' : 'dark'}
        richColors
        closeButton
      />
    </QueryClientProvider>
  )
}

export default App
