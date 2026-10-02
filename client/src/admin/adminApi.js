// Admin panelinin tüm istekleri ana api.js üzerinden, /admin öneki ile gider.
// Token ekleme işi zaten api.js interceptor'ında yapılıyor.
import api from '../api';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getOverview: (days) => api.get('/admin/insights/overview', { params: { days } }),
  getCampusInsights: (days) => api.get('/admin/insights/campuses', { params: { days } }),

  previewAudience: (audience) => api.post('/admin/campaigns/preview', { audience }),
  getCampaigns: () => api.get('/admin/campaigns'),
  sendCampaign: (data) => api.post('/admin/campaigns', data),
  stopBanner: (id) => api.post(`/admin/campaigns/${id}/stop-banner`),
  deleteCampaign: (id) => api.delete(`/admin/campaigns/${id}`),

  getUsers: (params) => api.get('/admin/users', { params }),
  exportUsers: (params) => api.get('/admin/users/export.csv', { params, responseType: 'blob' }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  notifyUser: (id, data) => api.post(`/admin/users/${id}/notify`, data),

  getUniversities: () => api.get('/admin/universities'),
  createUniversity: (data) => api.post('/admin/universities', data),
  updateUniversity: (id, data) => api.patch(`/admin/universities/${id}`, data),
  deleteUniversity: (id) => api.delete(`/admin/universities/${id}`),
  getDepartments: () => api.get('/admin/departments'),

  getPosts: (params) => api.get('/admin/posts', { params }),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  getClubs: (params) => api.get('/admin/clubs', { params }),
  deleteClub: (id) => api.delete(`/admin/clubs/${id}`),
  getEvents: (scope) => api.get('/admin/events', { params: { scope } }),
  deleteEvent: (id) => api.delete(`/admin/events/${id}`),

  getReports: (params) => api.get('/admin/reports', { params }),
  updateReport: (id, data) => api.patch(`/admin/reports/${id}`, data),
  reportAction: (id, action) => api.post(`/admin/reports/${id}/action`, { action }),

  getAdmins: () => api.get('/admin/admins'),
  addAdmin: (email) => api.post('/admin/admins', { email }),
};

// Kuyruk/şikayet kararından sonra kenar çubuğu rozetlerini tazele
export const refreshCounts = () => window.dispatchEvent(new Event('adm-counts'));

export const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export default adminApi;
