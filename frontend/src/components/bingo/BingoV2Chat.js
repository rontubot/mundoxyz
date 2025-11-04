import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import './BingoV2Chat.css';

const BingoV2Chat = ({ roomCode }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('bingo:chat_message', (data) => {
        setMessages(prev => [...prev, {
          userId: data.userId,
          username: data.username,
          message: data.message,
          timestamp: new Date(data.timestamp)
        }]);
        scrollToBottom();
      });

      return () => {
        socket.off('bingo:chat_message');
      };
    }
  }, [socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket) return;
    
    socket.emit('bingo:chat_message', {
      roomCode,
      userId: user.id,
      message: inputMessage.trim()
    });
    
    setInputMessage('');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bingo-v2-chat ${isMinimized ? 'minimized' : ''}`}>
      <div className="chat-header" onClick={() => setIsMinimized(!isMinimized)}>
        <h3>💬 Chat</h3>
        <button className="minimize-btn">
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
      
      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`message ${msg.userId === user?.id ? 'own' : ''}`}
              >
                <span className="username">{msg.username}</span>
                <span className="time">{formatTime(msg.timestamp)}</span>
                <p className="text">{msg.message}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength={200}
            />
            <button type="submit">Enviar</button>
          </form>
        </>
      )}
    </div>
  );
};

export default BingoV2Chat;
