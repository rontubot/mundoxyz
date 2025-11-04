import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, TrendingUp, Award, Target, Zap } from 'lucide-react';

const ExperienceModal = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  const currentXP = user?.experience || 0;
  const totalGamesPlayed = user?.total_games_played || 0;
  const totalGamesWon = user?.total_games_won || 0;

  // Calcular nivel (cada 100 XP = 1 nivel)
  const level = Math.floor(currentXP / 100) + 1;
  const xpInCurrentLevel = currentXP % 100;
  const xpToNextLevel = 100 - xpInCurrentLevel;
  const progressPercent = (xpInCurrentLevel / 100) * 100;

  // Milestones desbloqueados
  const milestones = [
    { level: 1, name: 'Novato', description: 'Comienza tu aventura', unlocked: level >= 1, icon: '🌱' },
    { level: 5, name: 'Autocanto Bingo', description: 'Desbloquea autocanto en Bingo (400+ XP)', unlocked: currentXP >= 400, icon: '🎯' },
    { level: 10, name: 'Veterano', description: 'Has jugado más de 1000 XP', unlocked: level >= 10, icon: '⚔️' },
    { level: 15, name: 'Maestro', description: 'Nivel maestro alcanzado', unlocked: level >= 15, icon: '👑' },
    { level: 20, name: 'Leyenda', description: 'Leyenda del mundoxyz', unlocked: level >= 20, icon: '🏆' }
  ];

  const winRate = totalGamesPlayed > 0 ? ((totalGamesWon / totalGamesPlayed) * 100).toFixed(1) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="card-glass max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-glass">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Star className="text-accent" size={28} />
              Experiencia
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-glass rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Nivel y XP actual */}
          <div className="mb-6 p-6 bg-gradient-to-br from-violet/20 to-accent/20 rounded-lg border border-violet/30">
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-gradient-accent mb-2">
                Nivel {level}
              </div>
              <div className="text-xl text-text/80">
                {currentXP} XP Total
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-text/60">
                <span>{xpInCurrentLevel} XP</span>
                <span>{xpToNextLevel} XP para nivel {level + 1}</span>
              </div>
              <div className="w-full bg-glass rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-violet to-accent"
                />
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-glass rounded-lg">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-accent" />
              <div className="text-2xl font-bold text-accent">{totalGamesPlayed}</div>
              <div className="text-xs text-text/60">Partidas</div>
            </div>
            <div className="text-center p-4 bg-glass rounded-lg">
              <Award className="w-6 h-6 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold text-success">{totalGamesWon}</div>
              <div className="text-xs text-text/60">Victorias</div>
            </div>
            <div className="text-center p-4 bg-glass rounded-lg">
              <Target className="w-6 h-6 mx-auto mb-2 text-fire-orange" />
              <div className="text-2xl font-bold text-fire-orange">{winRate}%</div>
              <div className="text-xs text-text/60">Win Rate</div>
            </div>
          </div>

          {/* Milestones */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Zap className="text-accent" size={20} />
              Hitos Desbloqueados
            </h3>
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    milestone.unlocked
                      ? 'bg-success/10 border-success/30'
                      : 'bg-glass border-glass opacity-50'
                  }`}
                >
                  <div className="text-3xl">{milestone.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-text">
                      {milestone.name}
                      {milestone.unlocked && (
                        <span className="ml-2 text-success text-sm">✓</span>
                      )}
                    </div>
                    <div className="text-xs text-text/60">{milestone.description}</div>
                    {!milestone.unlocked && (
                      <div className="text-xs text-text/40 mt-1">
                        Nivel {milestone.level} requerido
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Info adicional */}
          <div className="p-4 bg-violet/10 border border-violet/30 rounded-lg mb-4">
            <div className="text-sm text-text/80">
              <p className="mb-2">💡 <strong>¿Cómo ganar XP?</strong></p>
              <ul className="list-disc list-inside space-y-1 text-text/60 text-xs">
                <li>+1 XP por cada partida de TicTacToe (ganes o pierdas)</li>
                <li>+1 XP por cada partida de Bingo completada</li>
                <li>Bonus de +1 XP al ganar cualquier juego</li>
              </ul>
            </div>
          </div>

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Cerrar
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ExperienceModal;
