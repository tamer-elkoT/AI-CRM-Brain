// ============================================================
// AI CRM Brain — Shared TypeScript Interfaces
// ============================================================

// --- Auth ---
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
  business_field?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface DecodedToken {
  sub: string;
  exp: number;
}

// --- Dashboard ---
export interface DashboardKPIs {
  total_active: number;
  high_priority_count: number;
  avg_ai_score: number;
}

export interface DealScatterPoint {
  deal_id: string;
  deal_name: string;
  amount: number;
  ai_score: number;
  priority: string;
}

export interface RankedDeal {
  deal_id: string;
  deal_name: string;
  account_name: string;
  priority: string;
  ml_score: number;
  ai_score: number;
  amount: number;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  scatter_points: DealScatterPoint[];
  ranked_deals: RankedDeal[];
}

export interface AccountRanking {
  account_name: string;
  avg_score: number;
  deal_count: number;
}

export interface AccountRankingResponse {
  accounts: AccountRanking[];
}

// --- Deal Detail ---
export interface DealDetail {
  deal_id: string;
  deal_name: string;
  account_name: string;
  stage: string;
  amount: number;
  closing_date: string;
  base_probability: number;
  adjusted_probability: number;
  recommendation_ar: string;
  recommendation_en: string | null;
  feature_vector: Record<string, number> | null;
  risk_flag: string | null;
  priority_tier: string | null;
  client_phone: string | null;
  client_email: string | null;
}

// --- Actions ---
export interface ActionResponse {
  status: string;
  message: string;
}

export interface SyncResponse {
  status: string;
  message: string;
  source?: string;
}

export interface GenerateResponse {
  status: string;
  message: string;
  batch_id: string;
  ml_predictions_generated: number;
  recommendations_generated: number;
  urgent_deals_flagged: number;
}
