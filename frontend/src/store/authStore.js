import { create } from 'zustand';
import api from '../api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('meetrix_token') || null,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('meetrix_token', data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  register: async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('meetrix_token', data.token);
    set({ user: data.user, token: data.token });
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('meetrix_token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/users/me');
      set({ user: data });
    } catch {
      set({ user: null, token: null });
      localStorage.removeItem('meetrix_token');
    }
  },
}));

export default useAuthStore;
