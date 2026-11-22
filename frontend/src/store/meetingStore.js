import { create } from 'zustand';
import api from '../api';

const useMeetingStore = create((set, get) => ({
  meetings: [],
  notifications: [],
  unreadNotifsCount: 0,
  analytics: null,
  loading: false,
  error: null,

  fetchMeetings: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/meetings', { params });
      set({ meetings: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createMeeting: async (payload) => {
    const { data } = await api.post('/meetings', payload);
    set((state) => ({ meetings: [data, ...state.meetings] }));
    return data;
  },

  updateMeeting: async (id, updates) => {
    const { data } = await api.put(`/meetings/${id}`, updates);
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === id ? data : m)),
    }));
    return data;
  },

  togglePinMeeting: async (id) => {
    const { data } = await api.patch(`/meetings/${id}/pin`);
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m._id === id ? { ...m, pinned: data.pinned } : m
      ),
    }));
  },

  duplicateMeeting: async (id) => {
    const { data } = await api.post(`/meetings/${id}/duplicate`);
    set((state) => ({ meetings: [data, ...state.meetings] }));
    return data;
  },

  deleteMeeting: async (id) => {
    await api.delete(`/meetings/${id}`);
    set((state) => ({ meetings: state.meetings.filter((m) => m._id !== id) }));
  },

  addDecision: async (meetingId, text) => {
    const { data } = await api.post(`/meetings/${meetingId}/decisions`, { text });
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === meetingId ? data : m)),
    }));
  },

  updateAttendance: async (meetingId, attendance) => {
    const { data } = await api.put(`/meetings/${meetingId}/attendance`, { attendance });
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === meetingId ? data : m)),
    }));
  },

  addComment: async (meetingId, text) => {
    const { data } = await api.post(`/meetings/${meetingId}/comments`, { text });
    const { data: updated } = await api.get(`/meetings/${meetingId}`);
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === meetingId ? updated : m)),
    }));
    return data;
  },

  addTask: async (meetingId, task) => {
    const { data } = await api.post(`/tasks/${meetingId}`, task);
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m._id === meetingId ? { ...m, tasks: [...m.tasks, data] } : m
      ),
    }));
    return data;
  },

  updateTaskStatus: async (meetingId, taskId, updates) => {
    const payload = typeof updates === 'string' ? { status: updates } : updates;
    const { data } = await api.patch(`/tasks/${meetingId}/${taskId}`, payload);
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m._id === meetingId
          ? { ...m, tasks: m.tasks.map((t) => (t._id === taskId ? data : t)) }
          : m
      ),
    }));
  },

  deleteTask: async (meetingId, taskId) => {
    await api.delete(`/tasks/${meetingId}/${taskId}`);
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m._id === meetingId
          ? { ...m, tasks: m.tasks.filter((t) => t._id !== taskId) }
          : m
      ),
    }));
  },

  saveInsight: async (meetingId, topic, text) => {
    const { data } = await api.post(`/insights/${meetingId}`, { topic, text });
    const { data: updated } = await api.get(`/meetings/${meetingId}`);
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === meetingId ? updated : m)),
    }));
    return data;
  },

  fetchNotifications: async () => {
    try {
      const { data } = await api.get('/notifications');
      set({ notifications: data.notifications, unreadNotifsCount: data.unreadCount });
    } catch (err) {
      console.error(err);
    }
  },

  markNotificationRead: async (id) => {
    await api.patch(`/notifications/${id}/read`);
    set((state) => ({
      notifications: state.notifications.map((n) => (n._id === id ? { ...n, read: true } : n)),
      unreadNotifsCount: Math.max(0, state.unreadNotifsCount - 1),
    }));
  },

  markAllNotificationsRead: async () => {
    await api.post('/notifications/read-all');
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadNotifsCount: 0,
    }));
  },

  fetchAnalytics: async (range = 'all') => {
    try {
      const { data } = await api.get('/analytics/dashboard', { params: { range } });
      set({ analytics: data });
    } catch (err) {
      console.error(err);
    }
  },

  askMeeting: async (meetingId, question) => {
    const { data } = await api.post(`/ai/${meetingId}/ask`, { question });
    return data.answer;
  },

  fetchAiSummary: async (meetingId) => {
    const { data } = await api.post(`/ai/${meetingId}/summary`);
    return data;
  },

  fetchAiAnalysis: async (meetingId) => {
    const { data } = await api.post(`/ai/${meetingId}/analysis`);
    return data;
  },

  fetchDecisionIntel: async (meetingId) => {
    const { data } = await api.post(`/ai/${meetingId}/decision-intel`);
    return data;
  },

  cancelMeeting: async (meetingId, cancelReason) => {
    const { data } = await api.put(`/meetings/${meetingId}`, {
      status: 'Cancelled',
      cancelReason,
    });
    set((state) => ({
      meetings: state.meetings.map((m) => (m._id === meetingId ? data : m)),
    }));
    return data;
  },

  saveNotes: async (meetingId, notes) => {
    const { data } = await api.patch(`/meetings/${meetingId}/notes`, { notes });
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m._id === meetingId ? { ...m, notes: data.notes } : m
      ),
    }));
    return data;
  },

  allTasks: () => {
    return get().meetings.flatMap((m) =>
      (m.tasks || []).map((t) => ({ ...t, meetingTitle: m.title, meetingId: m._id }))
    );
  },
}));

export default useMeetingStore;
