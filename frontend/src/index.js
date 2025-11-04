import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Force rebuild v3 - BuyCardsModal integration

// Initialize Telegram WebApp
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  
  // Expand to full height
  tg.expand();
  
  // Enable closing confirmation
  tg.enableClosingConfirmation();
  
  // Set header color to match theme
  tg.setHeaderColor('#0B0E14');
  tg.setBackgroundColor('#0B0E14');
  
  // Ready
  tg.ready();
}

// Error boundary para capturar errores
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          color: 'white',
          backgroundColor: '#1a1a1a',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: 'red' }}>❌ Error en la Aplicación</h1>
          <h2>Error:</h2>
          <pre style={{ color: 'orange', whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <h2>Stack:</h2>
          <pre style={{ color: 'yellow', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              marginTop: '20px',
              backgroundColor: '#22d3ee',
              color: 'black',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error al inicializar React:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; color: white; background: #1a1a1a; min-height: 100vh;">
      <h1 style="color: red;">❌ Error Crítico al Iniciar</h1>
      <pre style="color: yellow;">${error.toString()}</pre>
      <p>Revisa la Console del navegador (F12) para más detalles.</p>
    </div>
  `;
}
