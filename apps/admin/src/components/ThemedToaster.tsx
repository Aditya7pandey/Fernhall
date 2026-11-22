import { Toaster } from 'sonner'
import { useTheme } from '../hooks/useTheme'

export function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />
}
