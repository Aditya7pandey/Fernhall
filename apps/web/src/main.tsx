import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import './index.css'
import { queryClient } from './lib/query'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-ink !text-canvas !shadow-lift !font-sans',
            description: '!text-canvas/70',
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
