import './styles/globals.css'
import './styles/agent.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startThemeSync } from './utils/theme'

startThemeSync()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
