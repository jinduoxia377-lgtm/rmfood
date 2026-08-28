const React = window.React
const ReactDOM = window.ReactDOM

function App() {
  return React.createElement('div', {style: {color: 'red'}}, 'Hello World!')
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(React.createElement(App))
