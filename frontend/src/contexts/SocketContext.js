import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection
    // Use REACT_APP_API_URL in production (backend URL) or window.location.origin in dev
    const apiUrl = process.env.REACT_APP_API_URL || '';
    
    // Determine the socket URL
    let socketUrl;
    if (apiUrl && apiUrl !== '') {
      // Production: use the backend URL
      socketUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      console.log('Socket connecting to backend:', socketUrl);
    } else {
      // Development: use current origin (proxied)
      socketUrl = window.location.origin;
      console.log('Socket connecting to origin:', socketUrl);
    }
    
    const newSocket = io(socketUrl, {
      auth: {
        userId: user.id,
        username: user.username
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      timeout: 20000
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Set socket
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const value = {
    socket,
    connected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
