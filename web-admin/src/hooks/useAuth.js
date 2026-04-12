import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, clearToken } from '../lib/api';

export function useAuth() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthed(false);
    navigate('/login');
  }, [navigate]);

  return { authed, setAuthed, logout };
}
