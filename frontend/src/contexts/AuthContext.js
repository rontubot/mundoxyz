import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Configure axios defaults
// In production, REACT_APP_API_URL should be the backend URL (e.g., https://backend.railway.app)
// In development, proxy in package.json handles routing to backend
const apiUrl = process.env.REACT_APP_API_URL;

// Only set baseURL if we have a valid URL (for production)
if (apiUrl && apiUrl !== '') {
  // Remove trailing slash if present
  const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  console.log('Setting axios baseURL to:', cleanUrl);
  axios.defaults.baseURL = cleanUrl;
} else {
  console.log('No API URL set, using relative paths (development mode)');
}

axios.defaults.withCredentials = true;

// Add request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar error 429 (rate limit) - NO hacer logout
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 5;
      console.warn(`Rate limit alcanzado. Reintentando en ${retryAfter}s...`);
      // No redirigir ni limpiar sesión
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      // Excluir endpoints de contraseña del logout automático
      const url = error.config?.url || '';
      const isPasswordEndpoint = url.includes('/check-password') || 
                                  url.includes('/change-password');
      
      // Solo hacer logout si NO es un endpoint de contraseña
      if (!isPasswordEndpoint) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Helper para normalizar roles siempre como array
  const normalizeUserData = (userData) => {
    return {
      ...userData,
      roles: Array.isArray(userData?.roles) ? userData.roles : 
             (userData?.roles ? [userData.roles] : ['user']),
      // Normalizar security_answer: backend puede enviar has_security_answer o security_answer
      security_answer: userData?.security_answer !== undefined 
        ? userData.security_answer 
        : (userData?.has_security_answer || false)
    };
  };

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          // Validate token with backend
          const response = await axios.get('/api/roles/me');
          const userData = JSON.parse(storedUser);
          // Asegurar que roles sea un array y manejar ambos formatos
          const rolesArray = response.data.roles || [];
          const normalizedRoles = rolesArray.map(r => typeof r === 'string' ? r : r.name).filter(Boolean);
          setUser({
            ...userData,
            roles: normalizedRoles
          });
        } catch (error) {
          console.error('Session validation failed:', error);
          // Solo limpiar sesión si es error de autenticación (401/403)
          // NO limpiar en error 429 (rate limit) o errores de red
          if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } else if (error.response?.status === 429) {
            console.warn('Rate limit alcanzado, sesión válida pero temporalmente bloqueada');
            // Mantener token y user, solo loggear el warning
          }
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  const loginWithTelegram = async () => {
    try {
      setLoading(true);
      
      // Get Telegram WebApp data
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        throw new Error('Telegram WebApp no disponible');
      }

      const response = await axios.post('/api/auth/login-telegram', {
        initData: tg.initData
      });

      const { token, user: userData } = response.data;
      
      // Normalizar datos del usuario
      const normalizedUser = normalizeUserData(userData);
      
      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      setUser(normalizedUser);
      toast.success('¡Bienvenido a MUNDOXYZ!');
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithCredentials = async (username, password) => {
    try {
      setLoading(true);
      
      const response = await axios.post('/api/auth/login-email', {
        email: username,
        password
      });

      const { token, user: userData } = response.data;
      
      // Normalizar datos del usuario
      const normalizedUser = normalizeUserData(userData);
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      setUser(normalizedUser);
      toast.success('¡Bienvenido a MUNDOXYZ!');
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    try {
      setLoading(true);
      
      // Validar que security_answer exista y tenga contenido
      const securityAnswer = (formData.security_answer || '').trim();
      if (!securityAnswer || securityAnswer.length < 3) {
        toast.error('La respuesta de seguridad debe tener al menos 3 caracteres');
        return { success: false, error: 'Respuesta de seguridad inválida' };
      }
      
      const response = await axios.post('/api/auth/register', {
        username: formData.username,
        email: formData.email,
        emailConfirm: formData.emailConfirm,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
        security_answer: securityAnswer,
        tg_id: formData.tg_id || null
      });

      toast.success(response.data.message || '¡Registro exitoso!');
      
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || 'Error al registrar usuario';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateUser = (userData) => {
    const normalizedUser = normalizeUserData(userData);
    setUser(normalizedUser);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get(`/api/profile/${user.id}`);
      const profileData = response.data;
      
      // Construir usuario actualizado con TODOS los campos nuevos
      const updatedUser = {
        id: profileData.id,
        username: profileData.username,
        display_name: profileData.display_name,
        nickname: profileData.nickname,
        bio: profileData.bio,
        email: profileData.email,
        tg_id: profileData.tg_id,
        avatar_url: profileData.avatar_url,
        locale: profileData.locale,
        is_verified: profileData.is_verified,
        created_at: profileData.created_at,
        last_seen_at: profileData.last_seen_at,
        roles: Array.isArray(profileData.roles) ? profileData.roles : 
               Array.isArray(user.roles) ? user.roles : [],
        wallet_id: profileData.wallet_id,
        // Seguridad
        security_answer: profileData.security_answer || false,
        // Balances del stats
        coins_balance: profileData.stats?.coins_balance || 0,
        fires_balance: profileData.stats?.fires_balance || 0,
        total_coins_earned: profileData.stats?.total_coins_earned || 0,
        total_fires_earned: profileData.stats?.total_fires_earned || 0,
        total_coins_spent: profileData.total_coins_spent || 0,
        total_fires_spent: profileData.total_fires_spent || 0,
        // Experiencia
        experience: profileData.experience || 0,
        total_games_played: profileData.total_games_played || 0,
        total_games_won: profileData.total_games_won || 0
      };
      
      updateUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error refreshing user:', error);
      return null;
    }
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  const isAdmin = () => {
    return hasRole('admin') || hasRole('tote');
  };

  const isTote = () => {
    return hasRole('tote');
  };

  const value = {
    user,
    loading,
    loginWithTelegram,
    loginWithCredentials,
    register,
    logout,
    updateUser,
    refreshUser,
    hasRole,
    isAdmin,
    isTote
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
