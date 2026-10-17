import {
  AuthResponse,
  User,
  Report,
  ReportListResponse,
  Category,
  CampusLocation,
  StorageLocation,
  Match,
  Claim,
  CustodyRecord,
  ReturnRecord,
  NotificationItem,
  SystemStats,
  ModelHealth,
  AuditLog,
  ItemImage,
  College,
  RegisterRequest,
  UserProfileUpdate,
  NinjaDetectionResult,
  NinjaDetectionStatus,
  ScanMatchResponse,
  AlertTeacherRequest,
  AlertTeacherResponse
} from '../types';

const API_BASE = '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('campustrace_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('campustrace_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('campustrace_token');
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errJson = await response.json();
      if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail
          .map((item: any) => {
            if (typeof item === 'string') return item;
            const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : '';
            const msg = item.msg || item.message || JSON.stringify(item);
            return field && field !== 'body' ? `${field}: ${msg}` : msg;
          })
          .join(', ');
      } else if (typeof errJson.detail === 'object' && errJson.detail !== null) {
        errorDetail = errJson.detail.message || errJson.detail.msg || JSON.stringify(errJson.detail);
      } else if (typeof errJson.detail === 'string') {
        errorDetail = errJson.detail;
      } else if (errJson.message) {
        errorDetail = typeof errJson.message === 'string' ? errJson.message : JSON.stringify(errJson.message);
      } else {
        errorDetail = JSON.stringify(errJson);
      }
    } catch {
      errorDetail = response.statusText || 'Network request failed';
    }
    throw new Error(errorDetail);
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Colleges
  getColleges: (): Promise<College[]> => request<College[]>('/colleges'),
  verifyCollege: (code: string): Promise<{ valid: boolean; is_valid: boolean; college_id: number; college_code: string; name: string }> =>
    request<{ valid: boolean; is_valid: boolean; college_id: number; college_code: string; name: string }>(`/colleges/verify/${encodeURIComponent(code)}`),

  // Auth
  login: (username_or_email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email, password }),
    }),

  register: (data: RegisterRequest): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string): Promise<{ message: string; reset_token?: string }> =>
    request<{ message: string; reset_token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (reset_token: string, new_password: string): Promise<{ success: boolean; message: string }> =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ reset_token, new_password }),
    }),

  getCurrentUser: (): Promise<User> => request<User>('/auth/me'),

  updateProfile: (data: UserProfileUpdate): Promise<User> =>
    request<User>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  logout: (): Promise<{ message: string }> =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Categories & Locations
  getCategories: (): Promise<Category[]> => request<Category[]>('/categories'),
  getCampusLocations: (): Promise<CampusLocation[]> => request<CampusLocation[]>('/campus-locations'),
  getStorageLocations: (): Promise<StorageLocation[]> => request<StorageLocation[]>('/storage-locations'),

  // Users Directory
  getUsersDirectory: (query?: string, role?: string): Promise<User[]> => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (role) params.set('role', role);
    return request<User[]>(`/users?${params.toString()}`);
  },

  // Reports
  getReports: (params: {
    report_type?: string;
    category_id?: number;
    location_id?: number;
    status?: string;
    my_reports?: boolean;
    awaiting_handover?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<ReportListResponse> => {
    const query = new URLSearchParams();
    if (params.report_type) query.set('report_type', params.report_type);
    if (params.category_id) query.set('category_id', params.category_id.toString());
    if (params.location_id) query.set('location_id', params.location_id.toString());
    if (params.status) query.set('status', params.status);
    if (params.my_reports) query.set('my_reports', 'true');
    if (params.awaiting_handover) query.set('awaiting_handover', 'true');
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page.toString());
    if (params.page_size) query.set('page_size', params.page_size.toString());
    return request<ReportListResponse>(`/reports?${query.toString()}`);
  },

  getReportDetail: (id: number): Promise<Report> => request<Report>(`/reports/${id}`),

  createReport: (data: {
    report_type: 'LOST' | 'FOUND';
    item_name: string;
    category_id: number;
    location_id?: number;
    location_name?: string;
    manual_campus_location?: string;
    report_date: string;
    approximate_event_time?: string;
    detailed_description: string;
    visual_description?: string;
    color?: string;
    brand?: string;
    distinguishing_features?: string;
    priority?: string;
    reported_lost_by_student_id?: number;
    reported_found_by_student_id?: number;
    storage_location_id?: number;
    confirm_physical_receipt?: boolean;
  }): Promise<Report> =>
    request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateReport: (id: number, data: Partial<Report>): Promise<Report> =>
    request<Report>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  analyzeImage: (file: File): Promise<{
    storage_key: string;
    primary_color: string;
    suggested_category_id: number | null;
    suggested_category_name: string;
    suggested_item_name: string;
    suggested_description: string;
    aspect_ratio: number;
    headline: string;
    visual_features: any;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/reports/analyze-image', {
      method: 'POST',
      body: formData,
    });
  },

  uploadReportImage: (reportId: number, file: File): Promise<ItemImage> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<ItemImage>(`/reports/${reportId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  getReportMatches: (reportId: number): Promise<Match[]> =>
    request<Match[]>(`/reports/${reportId}/matches`),

  closeReport: (reportId: number, data: { reason: string; notes?: string }): Promise<{ message: string; id: number; report_number: string; status: string }> =>
    request<{ message: string; id: number; report_number: string; status: string }>(`/reports/${reportId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Matches
  getAllMatches: (status?: string, minScore?: number): Promise<Match[]> => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (minScore !== undefined) params.set('min_score', minScore.toString());
    return request<Match[]>(`/matches?${params.toString()}`);
  },

  reviewMatch: (matchId: number, status: 'CONFIRMED' | 'REJECTED', notes?: string): Promise<Match> =>
    request<Match>(`/matches/${matchId}/review`, {
      method: 'POST',
      body: JSON.stringify({ match_status: status, notes }),
    }),

  // Claims
  submitClaim: (
    reportId: number,
    data: {
      claim_description: string;
      private_ownership_evidence: string;
      linked_lost_report_id?: number;
    }
  ): Promise<Claim> =>
    request<Claim>(`/found-reports/${reportId}/claims`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getClaims: (
    statusOrParams?: string | { status?: string; my_claims_only?: boolean; report_id?: number },
    myClaimsOnly: boolean = false
  ): Promise<Claim[]> => {
    const params = new URLSearchParams();
    if (typeof statusOrParams === 'object' && statusOrParams !== null) {
      if (statusOrParams.status) params.set('status', statusOrParams.status);
      if (statusOrParams.my_claims_only) params.set('my_claims_only', 'true');
      if (statusOrParams.report_id) params.set('report_id', statusOrParams.report_id.toString());
    } else {
      if (statusOrParams) params.set('status', statusOrParams);
      if (myClaimsOnly) params.set('my_claims_only', 'true');
    }
    return request<Claim[]>(`/claims?${params.toString()}`);
  },

  getClaimDetail: (claimId: number): Promise<Claim> => request<Claim>(`/claims/${claimId}`),

  reviewClaim: (claimId: number, status: 'APPROVED' | 'REJECTED', review_notes?: string): Promise<Claim> =>
    request<Claim>(`/claims/${claimId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, review_notes }),
    }),

  // Custody
  confirmHandover: (
    reportId: number,
    data: {
      storage_location_id: number;
      handover_notes?: string;
      finder_student_id?: number;
    }
  ): Promise<CustodyRecord> =>
    request<CustodyRecord>(`/reports/${reportId}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  transferCustody: (
    reportId: number,
    data: {
      new_custodian_id: number;
      storage_location_id?: number;
      handover_notes?: string;
    }
  ): Promise<CustodyRecord> =>
    request<CustodyRecord>(`/reports/${reportId}/custody-transfers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCustodyHistory: (reportId: number): Promise<CustodyRecord[]> =>
    request<CustodyRecord[]>(`/reports/${reportId}/custody-history`),

  // Returns
  executeReturn: (
    reportId: number,
    data: {
      claim_id: number;
      verification_method: string;
      notes?: string;
    }
  ): Promise<ReturnRecord> =>
    request<ReturnRecord>(`/reports/${reportId}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getReturns: (): Promise<ReturnRecord[]> => request<ReturnRecord[]>('/returns'),

  // Notifications
  getNotifications: (): Promise<NotificationItem[]> => request<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: number): Promise<NotificationItem> =>
    request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: (): Promise<{ message: string }> =>
    request<{ message: string }>('/notifications/read-all', { method: 'POST' }),

  // Admin
  getAnalytics: (): Promise<SystemStats> => request<SystemStats>('/admin/analytics'),
  getAuditLogs: (action?: string, entityType?: string): Promise<AuditLog[]> => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (entityType) params.set('entity_type', entityType);
    return request<AuditLog[]>(`/admin/audit-logs?${params.toString()}`);
  },
  getModelHealth: (): Promise<ModelHealth> => request<ModelHealth>('/admin/model-health'),

  // API Ninjas Object Detection
  getNinjaDetectionStatus: (): Promise<NinjaDetectionStatus> =>
    request<NinjaDetectionStatus>('/detection/status'),

  ninjaDetectObjects: (file: File): Promise<NinjaDetectionResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<NinjaDetectionResult>('/detection/ninja-detect', {
      method: 'POST',
      body: formData,
    });
  },

  scanFoundMatches: (file: File): Promise<ScanMatchResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<ScanMatchResponse>('/detection/scan-found-matches', {
      method: 'POST',
      body: formData,
    });
  },

  alertTeacher: (data: AlertTeacherRequest): Promise<AlertTeacherResponse> =>
    request<AlertTeacherResponse>('/detection/alert-teacher', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
