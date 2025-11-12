import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <div className="fixed-watermark">Made by Sahaj Khandelwal</div>
  </React.StrictMode>,
)
