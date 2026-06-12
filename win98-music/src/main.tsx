import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/win98.css'

// Note: no React.StrictMode — it double-mounts effects in dev, which would
// spin up two YouTube players. The player creation is a one-shot side effect.
createRoot(document.getElementById('root')!).render(<App />)
