import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [driver, setDriver] = useState(() => {
    const saved = localStorage.getItem('driver');
    return saved ? JSON.parse(saved) : null;
  });
  const [truck, setTruck] = useState(() => {
    const saved = localStorage.getItem('truck');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          if (res?.user) {
            setUser(res.user);
            setDriver(res.driver || null);
            setTruck(res.truck || null);
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.driver) localStorage.setItem('driver', JSON.stringify(res.driver));
            if (res.truck) localStorage.setItem('truck', JSON.stringify(res.truck));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
      if (res.driver) {
        setDriver(res.driver);
        localStorage.setItem('driver', JSON.stringify(res.driver));
      } else {
        setDriver(null);
        localStorage.removeItem('driver');
      }
      if (res.truck) {
        setTruck(res.truck);
        localStorage.setItem('truck', JSON.stringify(res.truck));
      } else {
        setTruck(null);
        localStorage.removeItem('truck');
      }
      return res;
    }
    throw new Error('Login failed');
  };

  const quickLogin = async (roleOrEmail, customPassword = null) => {
    setLoading(true);
    try {
      if (roleOrEmail === 'admin') {
        await login('soneschool1@gmail.com', 'sone@7151');
      } else if (typeof roleOrEmail === 'object' && (roleOrEmail?.email || roleOrEmail?.phone)) {
        await login(roleOrEmail.email || roleOrEmail.phone, roleOrEmail.temp_password || customPassword || 'driver123');
      } else if (typeof roleOrEmail === 'string' && (roleOrEmail.includes('@') || roleOrEmail.startsWith('+') || /^\d+$/.test(roleOrEmail.trim()))) {
        await login(roleOrEmail, customPassword || 'driver123');
      } else if (roleOrEmail === 'name') {
        await login('name@sino.com', 'driver123');
      } else if (roleOrEmail === 'john') {
        await login('john@sino.com', 'driver123');
      } else if (roleOrEmail === 'ahmed') {
        await login('ahmed@sino.com', 'driver123');
      } else if (typeof roleOrEmail === 'string') {
        await login(roleOrEmail, customPassword || 'driver123');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('driver');
    localStorage.removeItem('truck');
    setUser(null);
    setDriver(null);
    setTruck(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res?.user) {
        setUser(res.user);
        setDriver(res.driver || null);
        setTruck(res.truck || null);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateProfile = async (payload) => {
    const res = await api.put('/auth/profile', payload);
    if (res?.user) {
      setUser(res.user);
      localStorage.setItem('user', JSON.stringify(res.user));
      if (res.driver) {
        setDriver(res.driver);
        localStorage.setItem('driver', JSON.stringify(res.driver));
      }
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driver,
        truck,
        role: user?.role || null,
        isAuthenticated: !!user,
        loading,
        login,
        quickLogin,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
