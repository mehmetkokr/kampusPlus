// Admin panelinin tüm istekleri ana api.js üzerinden, /admin öneki ile gider.
// Token ekleme işi zaten api.js interceptor'ında yapılıyor.
import api from '../api';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getSignups: () => api.get('/admin/stats/signups'),
  getEngagement: () => api.get('/admin/stats/engagement'),
  getCampusStats: () => api.get('/admin/stats/campuses'),

  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  getUniversities: () => api.get('/admin/universities'),
  createUniversity: (data) => api.post('/admin/universities', data),
  updateUniversity: (id, data) => api.patch(`/admin/universities/${id}`, data),
  deleteUniversity: (id) => api.delete(`/admin/universities/${id}`),

  getDepartments: () => api.get('/admin/departments'),

  getPosts: (params) => api.get('/admin/posts', { params }),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),

  getReports: (params) => api.get('/admin/reports', { params }),
  updateReport: (id, data) => api.patch(`/admin/reports/${id}`, data),

};

export default adminApi;
