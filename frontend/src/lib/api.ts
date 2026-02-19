import axios from 'axios'

const API_BASE = '/api'

export const api = {
  auth: {
    login: (email: string, password: string, loginAs?: string) =>
      axios.post(`${API_BASE}/auth/login`, { email, password, login_as: loginAs || 'student' }),
    registerOrganizerSendOtp: (data: { email: string; password: string; full_name: string; phone_number: string }) =>
      axios.post(`${API_BASE}/auth/register-organizer-send-otp`, data),
    registerOrganizerVerify: (tempToken: string, code: string) =>
      axios.post(`${API_BASE}/auth/register-organizer-verify`, { temp_token: tempToken, code }),
  },
  events: {
    list: (status?: string) => axios.get(`${API_BASE}/events`, { params: { status_filter: status } }),
    get: (id: number) => axios.get(`${API_BASE}/events/${id}`),
    getByCode: (code: string) => axios.get(`${API_BASE}/events/by-code/${encodeURIComponent(code)}`),
    storageUsage: () => axios.get(`${API_BASE}/events/storage-usage`),
    create: (data: { name: string; description?: string; event_date?: string }) =>
      axios.post(`${API_BASE}/events`, data),
    update: (id: number, data: Partial<{ name: string; description: string; event_date: string; status: string }>) =>
      axios.patch(`${API_BASE}/events/${id}`, data),
    delete: (id: number) => axios.delete(`${API_BASE}/events/${id}`),
    processingStatus: (id: number) => axios.get(`${API_BASE}/events/${id}/processing-status`),
  },
  photos: {
    upload: (eventId: number, files: File[]) => {
      const form = new FormData()
      files.forEach(f => form.append('files', f))
      return axios.post(`${API_BASE}/photos/upload?event_id=${eventId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    delete: (photoId: number) => axios.delete(`${API_BASE}/photos/${photoId}`),
    download: async (photoId: number, filename: string) => {
      const res = await axios.get(`${API_BASE}/photos/${photoId}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'photo.jpg'
      a.click()
      window.URL.revokeObjectURL(url)
    },
    search: (file?: File | null, eventId?: number, accessCode?: string) => {
      const fd = new FormData()
      if (file) fd.append('file', file)
      if (eventId) fd.append('event_id', String(eventId))
      if (accessCode) fd.append('access_code', accessCode)
      return axios.post(`${API_BASE}/photos/search`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
  },
  face: {
    register: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return axios.post(`${API_BASE}/face/register`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    remove: () => axios.delete(`${API_BASE}/face/register`),
  },
}
