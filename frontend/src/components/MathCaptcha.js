import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const MathCaptcha = ({ onValidate }) => {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState('+');
  const [userAnswer, setUserAnswer] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Generar nuevo captcha
  const generateCaptcha = () => {
    const operators = ['+', '-', '*'];
    const newOperator = operators[Math.floor(Math.random() * operators.length)];
    
    let n1, n2;
    
    if (newOperator === '*') {
      // Para multiplicación, números más pequeños
      n1 = Math.floor(Math.random() * 10) + 1;
      n2 = Math.floor(Math.random() * 10) + 1;
    } else if (newOperator === '-') {
      // Para resta, asegurar resultado positivo
      n1 = Math.floor(Math.random() * 20) + 10;
      n2 = Math.floor(Math.random() * n1) + 1;
    } else {
      // Para suma
      n1 = Math.floor(Math.random() * 20) + 1;
      n2 = Math.floor(Math.random() * 20) + 1;
    }
    
    setNum1(n1);
    setNum2(n2);
    setOperator(newOperator);
    setUserAnswer('');
    setIsValid(false);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Calcular respuesta correcta
  const getCorrectAnswer = () => {
    switch (operator) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '*': return num1 * num2;
      default: return 0;
    }
  };

  // Validar respuesta
  useEffect(() => {
    const correctAnswer = getCorrectAnswer();
    const valid = parseInt(userAnswer) === correctAnswer;
    setIsValid(valid);
    onValidate(valid);
  }, [userAnswer, num1, num2, operator]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text/80">
        Resuelve esta operación para continuar
      </label>
      
      <div className="flex items-center gap-3">
        {/* Captcha Display */}
        <motion.div 
          className="flex-1 card-glass p-4 flex items-center justify-center gap-3 text-2xl font-bold"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          key={`${num1}-${operator}-${num2}`}
        >
          <span className="text-accent">{num1}</span>
          <span className="text-text/60">{operator}</span>
          <span className="text-accent">{num2}</span>
          <span className="text-text/60">=</span>
          <span className="text-violet">?</span>
        </motion.div>

        {/* Refresh Button */}
        <motion.button
          type="button"
          onClick={generateCaptcha}
          className="p-3 glass-panel hover:bg-glass-hover transition-all duration-200 rounded-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw size={20} className="text-accent" />
        </motion.button>
      </div>

      {/* Answer Input */}
      <div className="relative">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Tu respuesta"
          className={`input-glass w-full ${
            userAnswer && (isValid ? 'border-green-500 focus:ring-green-500/20' : 'border-red-500 focus:ring-red-500/20')
          }`}
        />
        
        {/* Validation Indicator */}
        {userAnswer && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {isValid ? (
              <span className="text-green-500 text-xl">✓</span>
            ) : (
              <span className="text-red-500 text-xl">✗</span>
            )}
          </motion.div>
        )}
      </div>

      {/* Hint */}
      {userAnswer && !isValid && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400"
        >
          Respuesta incorrecta. Intenta de nuevo o genera una nueva operación.
        </motion.p>
      )}
    </div>
  );
};

export default MathCaptcha;
