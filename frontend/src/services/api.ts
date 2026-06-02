import axios from 'axios';
import type {
  LoginRequest,
  SignupRequest,
  TokenResponse,
  DashboardResponse,
  DealDetail,
  ActionResponse,
  SyncResponse,
  AccountRankingResponse,
  GenerateResponse,
  AllDealsResponse,
  DealCreate,
  CreateDealResponse,
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to inject the token
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
  getAllDeals: (page: number = 1, pageSize: number = 20, search?: string, sortBy: string = 'ai_score'): Promise<AllDealsResponse> =>
    api.get('/deals', { params: { page, page_size: pageSize, search: search || undefined, sort_by: sortBy } }).then((res) => res.data),
  getAccountRanking: (): Promise<AccountRankingResponse> => api.get('/analytics/accounts/ranked').then((res) => res.data),
  getDealDetail: (id: string): Promise<DealDetail> => api.get(`/deals/${id}`).then((res) => res.data),
  createDeal: (data: DealCreate): Promise<CreateDealResponse> => api.post('/deals', data).then((res) => res.data),
  getAccountNames: (): Promise<string[]> => api.get('/accounts/names').then((res) => res.data),
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
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    }).then((res) => res.data),
};

export const authApi = {
  login: (data: LoginRequest): Promise<TokenResponse> => api.post('/auth/login', data).then((res) => res.data),
  signup: (data: SignupRequest): Promise<TokenResponse> => api.post('/auth/signup', data).then((res) => res.data),
  googleLogin: (credential: string): Promise<TokenResponse> => api.post('/auth/google', { credential }).then((res) => res.data),
};
