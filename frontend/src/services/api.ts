import axios from 'axios';
import type {
  LoginRequest,
  SignupRequest,
  TokenResponse,
  SignupPendingResponse,
  OTPVerifyRequest,
  UserProfile,
  TemplateUpdateRequest,
  DashboardResponse,
  DealDetail,
  ActionResponse,
  SyncResponse,
  AccountRankingResponse,
  GenerateResponse,
  AllDealsResponse,
  DealCreate,
  CreateDealResponse,
  NotificationListResponse,
  FollowupMarkRequest,
  FollowupMarkResponse,
  GenerateMessageResponse,
  StageUpdateResponse,
  AnalyticsResponse,
  PipelineAnalyticsResponse,
  AdminSignupRequest,
  TeamSignupRequest,
  InviteRequest,
  InviteResponse,
} from '../types';

// Read API base URL from environment variable (set in Vercel dashboard or .env.local).
// Falls back to localhost for local development.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject JWT automatically on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const dashboardApi = {
  getRankedDeals: (sortBy: string = 'ai_score', limit?: number): Promise<DashboardResponse> =>
    api.get('/deals/ranked', { params: { sort_by: sortBy, limit } }).then((res) => res.data),
  getAllDeals: (page: number = 1, pageSize: number = 20, search?: string, sortBy: string = 'ai_score', includeClosed: boolean = false): Promise<AllDealsResponse> =>
    api.get('/deals', { params: { page, page_size: pageSize, search: search || undefined, sort_by: sortBy, include_closed: includeClosed } }).then((res) => res.data),
  getAccountRanking: (): Promise<AccountRankingResponse> => api.get('/analytics/accounts/ranked').then((res) => res.data),
  getDealDetail: (id: string): Promise<DealDetail> => api.get(`/deals/${id}`).then((res) => res.data),
  createDeal: (data: DealCreate): Promise<CreateDealResponse> => api.post('/deals', data).then((res) => res.data),
  getAccountNames: (): Promise<string[]> => api.get('/accounts/names').then((res) => res.data),
  updateStage: (dealId: string, newStage: string): Promise<StageUpdateResponse> =>
    api.patch(`/deals/${dealId}/stage`, { new_stage: newStage }).then((res) => res.data),
  // Epic 2: Delete deal
  deleteDeal: (dealId: string): Promise<{ status: string; message: string; deal_id: string }> =>
    api.delete(`/deals/${dealId}`).then((res) => res.data),
  // Epic 2: Inline contact edit
  updateDealContact: (dealId: string, data: { client_phone?: string | null; client_email?: string | null }) =>
    api.patch(`/deals/${dealId}/contact`, data).then((res) => res.data),
  // Epic 3: Inline detail edit
  updateDealDetails: (dealId: string, data: { amount?: number | null; closing_date?: string | null }) =>
    api.patch(`/deals/${dealId}/details`, data).then((res) => res.data),
};

export const actionApi = {
  markActioned: (dealId: string): Promise<ActionResponse> => api.patch(`/recommendations/${dealId}/action`).then((res) => res.data),
  escalateDeal: (dealId: string): Promise<ActionResponse> => api.post(`/recommendations/${dealId}/escalate`).then((res) => res.data),
  triggerSync: (): Promise<SyncResponse> => api.post('/ingest/deals').then((res) => res.data),
  generateRecommendations: (): Promise<GenerateResponse> => api.post('/recommendations/generate').then((res) => res.data),
};

export const ingestionApi = {
  uploadCustomData: (formData: FormData, onUploadProgress?: (progressEvent: any) => void) =>
    api.post('/ingestion/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }).then((res) => res.data),
};

export const authApi = {
  login: (data: LoginRequest): Promise<TokenResponse> => api.post('/auth/login', data).then((res) => res.data),
  signup: (data: SignupRequest): Promise<SignupPendingResponse> => api.post('/auth/signup', data).then((res) => res.data),
  signupAdmin: (data: AdminSignupRequest): Promise<TokenResponse> => api.post('/auth/signup/admin', data).then((res) => res.data),
  signupTeam: (data: TeamSignupRequest): Promise<TokenResponse> => api.post('/auth/signup/team', data).then((res) => res.data),
  invite: (data: InviteRequest): Promise<InviteResponse> => api.post('/auth/invite', data).then((res) => res.data),
  verifyOtp: (data: OTPVerifyRequest): Promise<TokenResponse> => api.post('/auth/verify-otp', data).then((res) => res.data),
  googleLogin: (credential: string): Promise<TokenResponse> => api.post('/auth/google', { credential }).then((res) => res.data),
  // Epic 1.1: Zoho OAuth — returns { auth_url } which the frontend redirects to
  initiateZohoOAuth: (): Promise<{ auth_url: string }> => api.get('/auth/zoho/initiate').then((res) => res.data),
};

export const userApi = {
  getMe: (): Promise<UserProfile> => api.get('/auth/users/me').then((res) => res.data),
  // Epic 3: PATCH /users/me (full profile update)
  updateMe: (data: TemplateUpdateRequest): Promise<UserProfile> => api.patch('/auth/users/me', data).then((res) => res.data),
  // Legacy alias kept for existing callers
  updateTemplates: (data: TemplateUpdateRequest): Promise<UserProfile> => api.patch('/auth/users/me', data).then((res) => res.data),
};

// Sprint 5: Follow-up APIs
export const followupApi = {
  markFollowedUp: (dealId: string, data?: FollowupMarkRequest): Promise<FollowupMarkResponse> =>
    api.post(`/followups/${dealId}/mark`, data || {}).then((res) => res.data),
  generateMessage: (dealId: string, salesRepName?: string): Promise<GenerateMessageResponse> =>
    api.post(`/followups/${dealId}/generate-message`, { sales_rep_name: salesRepName }).then((res) => res.data),
  updateDays: (dealId: string, days: number): Promise<ActionResponse> =>
    api.patch(`/followups/${dealId}/days`, { days }).then((res) => res.data),
  scheduleFollowups: (): Promise<ActionResponse> =>
    api.post('/followups/schedule').then((res) => res.data),
};

// Sprint 5: Notification APIs
export const notificationApi = {
  getNotifications: (page: number = 1, pageSize: number = 20): Promise<NotificationListResponse> =>
    api.get('/notifications', { params: { page, page_size: pageSize } }).then((res) => res.data),
  getUnreadCount: (): Promise<{ unread_count: number }> =>
    api.get('/notifications/unread-count').then((res) => res.data),
  markRead: (notificationId: number): Promise<ActionResponse> =>
    api.patch(`/notifications/${notificationId}/read`).then((res) => res.data),
  markAllRead: (): Promise<ActionResponse> =>
    api.patch('/notifications/read-all').then((res) => res.data),
};

// Epic 2: Analytics API
export const analyticsApi = {
  getAnalytics: (startDate?: string, endDate?: string): Promise<AnalyticsResponse> =>
    api.get('/analytics', { params: { start_date: startDate, end_date: endDate } }).then((res) => res.data),
  getPipeline: (): Promise<PipelineAnalyticsResponse> =>
    api.get('/analytics/pipeline').then((res) => res.data),
};

// WhatsApp Integration API
export const whatsappApi = {
  getStatus: (): Promise<{ connected: boolean; has_qr: boolean; phone: string | null; error?: string }> =>
    api.get('/whatsapp/status').then((res) => res.data),
  getQR: (): Promise<{ status: 'pending' | 'connected' | 'waiting' | 'error'; qr: string | null; message?: string }> =>
    api.get('/whatsapp/qr').then((res) => res.data),
  disconnect: (): Promise<{ status: string }> =>
    api.post('/whatsapp/disconnect').then((res) => res.data),
};
