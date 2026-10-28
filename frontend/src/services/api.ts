const API_BASE = (import.meta.env.VITE_API_URL as string)
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, '')}/api/v1`
  : '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('ambulance_token');
}

export function setToken(token: string) {
  localStorage.setItem('ambulance_token', token);
}

export function clearToken() {
  localStorage.removeItem('ambulance_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (err: any) {
    throw new Error('Network connection failure. Check connectivity or server status.');
  }

  if (response.status === 401) {
    // If token expired, clear token and notify
    if (token) {
      clearToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = { error: `Server error (${response.status})` };
  }

  if (!response.ok) {
    const errorMsg = data.details
      ? data.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
      : data.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => request<any>('/auth/me'),
  createInvitation: (data: any) => request<any>('/auth/invitations', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvitation: (data: any) => request<any>('/auth/invitations/accept', { method: 'POST', body: JSON.stringify(data) }),

  // Emergencies
  createEmergency: (caseData: any) => request<any>('/emergencies', { method: 'POST', body: JSON.stringify(caseData) }),
  getCases: () => request<any>('/emergencies'),
  getCaseById: (id: string) => request<any>(`/emergencies/${id}`),
  trackCase: (caseNumber: string) => request<any>(`/emergencies/track/${caseNumber}`),
  updateCaseStatus: (id: string, status: string, notes?: string) =>
    request<any>(`/emergencies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
  manualAllocate: (caseId: string, ambulanceId: string, reason: string) =>
    request<any>(`/emergencies/${caseId}/allocate-manual`, { method: 'POST', body: JSON.stringify({ ambulanceId, reason }) }),
  submitHandover: (caseId: string, handoverData: any) =>
    request<any>(`/emergencies/${caseId}/handover`, { method: 'POST', body: JSON.stringify(handoverData) }),

  // Fleet
  getAmbulances: () => request<any>('/ambulances'),
  getAmbulanceById: (id: string) => request<any>(`/ambulances/${id}`),
  createAmbulance: (ambData: any) => request<any>('/ambulances', { method: 'POST', body: JSON.stringify(ambData) }),
  updateAmbulanceStatus: (id: string, status: string) =>
    request<any>(`/ambulances/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assignShift: (shiftData: any) => request<any>('/ambulances/shifts', { method: 'POST', body: JSON.stringify(shiftData) }),
  endShift: (ambulanceId: string) => request<any>(`/ambulances/${ambulanceId}/shifts/end`, { method: 'POST' }),

  // Hospitals
  getHospitals: () => request<any>('/hospitals'),
  getHospitalById: (id: string) => request<any>(`/hospitals/${id}`),
  createHospital: (hospitalData: any) => request<any>('/hospitals', { method: 'POST', body: JSON.stringify(hospitalData) }),
  updateCapacity: (hospitalId: string, capacity: any) =>
    request<any>(`/hospitals/${hospitalId}/capacity`, { method: 'PUT', body: JSON.stringify(capacity) }),
  respondCoordination: (caseId: string, hospitalId: string, responseData: any) =>
    request<any>(`/hospitals/coordination/${caseId}/${hospitalId}/respond`, { method: 'POST', body: JSON.stringify(responseData) }),

  // GPS & Tracking
  postLocation: (telemetry: any) => request<any>('/tracking/location', { method: 'POST', body: JSON.stringify(telemetry) }),
  getLocationHistory: (ambulanceId: string, limit = 50) => request<any>(`/tracking/history/${ambulanceId}?limit=${limit}`),
  getRoutingStatus: () => request<any>('/tracking/routing-status'),

  // Admin
  getAuditLogs: (page = 1, limit = 25, action?: string) =>
    request<any>(`/admin/audit-logs?page=${page}&limit=${limit}${action ? `&action=${action}` : ''}`),
  getUsers: () => request<any>('/admin/users'),
  updateUserStatus: (id: string, status: string) =>
    request<any>(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getSystemHealth: () => request<any>('/admin/system-health'),
};
