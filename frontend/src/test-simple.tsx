import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div style={{color: 'red', fontSize: '24px'}}>Hello World!</div>
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
