import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { supabase } from './supabase'
import './styles.css'

async function start() {
  // Если пришли по ссылке из письма (#access_token=...), сначала даём Supabase
  // забрать токен из адреса, и только потом запускаем роутер.
  if (supabase && /access_token=|error_description=/.test(window.location.hash)) {
    await supabase.auth.getSession()
    history.replaceState(null, '', window.location.pathname + '#/')
  }
  // HashRouter: адреса вида /#/today — работают на GitHub Pages без настройки сервера
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  )
}
start()
