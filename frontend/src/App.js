import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Games from './pages/Games';
import Profile from './pages/Profile';
import Lobby from './pages/Lobby';
import Raffles from './pages/Raffles';
import RafflesLobby from './pages/RafflesLobby';
import RaffleRoom from './pages/RaffleRoom';
import Market from './pages/Market';
import Roles from './pages/Roles';
import Upcoming from './pages/Upcoming';
import BingoLobby from './pages/BingoLobby';
import BingoV2WaitingRoom from './pages/BingoV2WaitingRoom';
import BingoV2GameRoom from './pages/BingoV2GameRoom';
import RaffleDetails from './pages/RaffleDetails';
import Admin from './pages/Admin';
import TicTacToeLobby from './pages/TicTacToeLobby';
import TicTacToeRoom from './pages/TicTacToeRoom';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  useEffect(() => {
    // Set viewport height for mobile
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    return () => window.removeEventListener('resize', setViewportHeight);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="App min-h-screen bg-background-dark text-text font-display">
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#121A2B',
                  color: '#E6EDF3',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.75rem',
                  backdropFilter: 'blur(10px)',
                },
                success: {
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#E6EDF3',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#E6EDF3',
                  },
                },
              }}
            />
            
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/games" replace />} />
                <Route path="games" element={<Games />} />
                <Route path="profile" element={<Profile />} />
                <Route path="lobby" element={<Lobby />} />
                <Route path="raffles" element={<Raffles />} />
                <Route path="raffles/lobby" element={<RafflesLobby />} />
                <Route path="raffles/:code" element={<RaffleDetails />} />
                <Route path="raffles/room/:code" element={<RaffleRoom />} />
                <Route path="market" element={<Market />} />
                <Route path="roles" element={<Roles />} />
                <Route path="upcoming" element={<Upcoming />} />
                <Route path="bingo" element={<BingoLobby />} />
                <Route path="bingo/v2/room/:code" element={<BingoV2WaitingRoom />} />
                <Route path="bingo/v2/play/:code" element={<BingoV2GameRoom />} />
                <Route path="tictactoe/lobby" element={<TicTacToeLobby />} />
                <Route path="tictactoe/room/:code" element={<TicTacToeRoom />} />
                <Route path="admin/*" element={<Admin />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
