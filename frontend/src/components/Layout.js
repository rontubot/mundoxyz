import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import MessageInbox from './MessageInbox';
import {
  User,
  DoorOpen,
  Gamepad2,
  Ticket,
  Store,
  Shield,
  Clock,
  Settings
} from 'lucide-react';
import ExperienceModal from './ExperienceModal';

const Layout = () => {
  const { user, isAdmin, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showBalanceTooltip, setShowBalanceTooltip] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);

  // Fetch balance en tiempo real
  const { data: balanceData } = useQuery({
    queryKey: ['header-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const response = await axios.get('/api/economy/balance');
      // Actualizar user en contexto con nuevo balance
      if (response.data) {
        updateUser({
          ...user,
          coins_balance: response.data.coins_balance,
          fires_balance: response.data.fires_balance
        });
      }
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 3000, // Refetch cada 3 segundos
    staleTime: 0
  });

  const displayCoins = parseFloat(balanceData?.coins_balance ?? user?.coins_balance ?? 0);
  const displayFires = parseFloat(balanceData?.fires_balance ?? user?.fires_balance ?? 0);
  const displayExperience = user?.experience || 0;

  const navItems = [
    { path: '/profile', icon: User, label: 'Perfil' },
    { path: '/lobby', icon: DoorOpen, label: 'Lobby' },
    { path: '/games', icon: Gamepad2, label: 'Juegos' },
    { path: '/raffles/lobby', icon: Ticket, label: 'Rifas' },
    { path: '/market', icon: Store, label: 'Mercado' },
    { path: '/roles', icon: Shield, label: 'Rol' },
    { path: '/upcoming', icon: Clock, label: 'Próximo' }
  ];

  if (isAdmin()) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* Header */}
      <header className="bg-card border-b border-glass px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gradient-accent">MUNDOXYZ</h1>
          <div className="flex items-center gap-4">
            {/* Balance Display - Clickeable */}
            <div className="flex items-center gap-3">
              <div 
                className="badge-experience cursor-pointer hover:scale-110 transition-transform"
                onClick={() => setShowExperienceModal(true)}
                title="Ver detalles de experiencia"
              >
                <span className="text-sm">⭐ {displayExperience} XP</span>
              </div>
              <div 
                className="badge-coins cursor-pointer hover:scale-110 transition-transform"
                onClick={() => navigate('/profile?tab=coins')}
                title="Ver historial de coins"
              >
                <span className="text-sm">🪙 {displayCoins.toFixed(2)}</span>
              </div>
              <div 
                className="badge-fire cursor-pointer hover:scale-110 transition-transform"
                onClick={() => navigate('/profile?tab=fires')}
                title="Ver historial de fuegos"
              >
                <span className="text-sm">🔥 {displayFires.toFixed(2)}</span>
              </div>
              
              {/* Message Inbox Button */}
              <MessageInbox />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-glass px-2 py-1 safe-bottom">
        <div className="flex justify-around text-xs text-center text-text/80">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                className={`nav-item ${
                  isActive ? 'bg-orange-500/20 shadow-fire text-orange-400' : ''
                }`}
              >
                <Icon size={24} className="mx-auto mb-1" />
                <span className="block">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Experience Modal */}
      <ExperienceModal 
        isOpen={showExperienceModal}
        onClose={() => setShowExperienceModal(false)}
        user={user}
      />
    </div>
  );
};

export default Layout;
