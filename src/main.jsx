import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {BrowserRouter} from "react-router-dom";
import { handleRedirectResult } from './utils/firebase.js'

(async () => {
  // Process any pending Firebase auth redirect (used as fallback when popup fails)
  try {
    await handleRedirectResult()
  } catch (e) {
    console.debug('redirect handling error', e)
  }

  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
})()
