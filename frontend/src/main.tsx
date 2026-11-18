import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'
import './styles/admin.css'
import './styles/pasajero.css'
import './styles/conductor.css'
// Después de los paneles: el encabezado y la barra lateral de escritorio que comparten (UI-02)
import './styles/paneles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
