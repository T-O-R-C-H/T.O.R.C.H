import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './site.css'
import './demo.css'
import './sections.css'
import './os.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
