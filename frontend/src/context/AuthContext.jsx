import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    const res = await api.get('/api/notifications');
    setNotifications(res.data.data || []);
    return res.data.data || [];
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('flowboard_token');
    const storedUser = localStorage.getItem('flowboard_user');
    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setToken(storedToken);
      } catch {
        localStorage.removeItem('flowboard_token');
        localStorage.removeItem('flowboard_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      return;
    }

    loadNotifications().catch(() => setNotifications([]));
  }, [token, user, loadNotifications]);

  function login(userData, jwt) {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('flowboard_token', jwt);
    localStorage.setItem('flowboard_user', JSON.stringify(userData));
  }

  function logout() {
    setUser(null);
    setToken(null);
    setNotifications([]);
    localStorage.removeItem('flowboard_token');
    localStorage.removeItem('flowboard_user');
  }

  async function markNotificationRead(notificationId) {
    await api.put(`/api/notifications/${notificationId}/read`);
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  }

  async function markAllNotificationsRead() {
    await api.put('/api/notifications/read-all');
    setNotifications([]);
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      loading,
      isAdmin: user?.role === 'ADMIN',
      notifications,
      unreadNotificationCount: notifications.length,
      refreshNotifications: loadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
