import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../config/api';
import './MessageInbox.css';
import GiftClaimButton from './gifts/GiftClaimButton';

const MessageInbox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, system, friends
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadMessages();
      
      // Poll for new messages every 30 seconds
      const interval = setInterval(loadMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await fetch(`${API_URL}/api/bingo/v2/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await fetch(`${API_URL}/api/bingo/v2/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      const messageToDelete = messages.find(m => m.id === messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      if (!messageToDelete?.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true;
    return msg.category === filter;
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return `Hace ${days} días`;
    } else {
      return date.toLocaleDateString('es-ES');
    }
  };

  return (
    <>
      {/* Inbox Button */}
      <button 
        className="inbox-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        📬
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>

      {/* Inbox Modal */}
      {isOpen && (
        <div className="inbox-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="inbox-modal" onClick={e => e.stopPropagation()}>
            <div className="inbox-header">
              <h2>📬 Buzón de Mensajes</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="inbox-tabs">
              <button 
                className={`tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todos ({messages.length})
              </button>
              <button 
                className={`tab ${filter === 'system' ? 'active' : ''}`}
                onClick={() => setFilter('system')}
              >
                Sistema ({messages.filter(m => m.category === 'system').length})
              </button>
              <button 
                className={`tab ${filter === 'friends' ? 'active' : ''}`}
                onClick={() => setFilter('friends')}
              >
                Amigos ({messages.filter(m => m.category === 'friends').length})
              </button>
            </div>

            {/* Messages List */}
            <div className="messages-list">
              {filteredMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No tienes mensajes</p>
                </div>
              ) : (
                filteredMessages.map(message => (
                  <div 
                    key={message.id} 
                    className={`message-item ${!message.is_read ? 'unread' : ''}`}
                    onClick={() => !message.is_read && markAsRead(message.id)}
                  >
                    <div className="message-header">
                      <span className="message-category">
                        {message.category === 'system' ? '🔧' : '👥'}
                        {message.category === 'system' ? 'Sistema' : 'Amigos'}
                      </span>
                      <span className="message-date">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    
                    <h4 className="message-title">{message.title}</h4>
                    <p className="message-content">{message.content}</p>
                    
                    {message.metadata && (
                      <div className="message-metadata">
                        {message.metadata.room_code && (
                          <span>Sala: #{message.metadata.room_code}</span>
                        )}
                        {message.metadata.prize && (
                          <span>Premio: {message.metadata.prize}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Gift Claim Button */}
                    {message.metadata?.type === 'gift_pending' && message.metadata.gift_id && (
                      <GiftClaimButton
                        giftId={message.metadata.gift_id}
                        coinsAmount={message.metadata.coins_amount || 0}
                        firesAmount={message.metadata.fires_amount || 0}
                        onClaimed={() => {
                          deleteMessage(message.id);
                          loadMessages();
                        }}
                      />
                    )}
                    
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMessage(message.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageInbox;
