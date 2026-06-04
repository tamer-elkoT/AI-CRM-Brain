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
  role: string;             // "Sales" or "Client"
  phone_number: string;     // required, with country code
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SignupPendingResponse {
  status: string;
  message: string;
  phone_number: string;
}

export interface OTPVerifyRequest {
  phone_number: string;
  otp_code: string;
}

export interface DecodedToken {
  sub: string;
  exp: number;
}

// --- User Profile ---
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  role: string;
  phone_number: string | null;
  is_whatsapp_verified: boolean;
  whatsapp_template: string | null;
  email_template: string | null;
}

export interface TemplateUpdateRequest {
  whatsapp_template?: string;
  email_template?: string;
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
  stage?: string;
  closing_date?: string;
  client_phone?: string | null;
  client_email?: string | null;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  scatter_points: DealScatterPoint[];
  ranked_deals: RankedDeal[];
}

export interface AllDealsResponse {
  items: RankedDeal[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
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

// --- Create Deal ---
export interface DealCreate {
  deal_name: string;
  account_name?: string;
  contact_name?: string;
  owner_name?: string;
  amount?: number;
  stage?: string;
  zoho_probability?: number;
  closing_date?: string;
  client_phone?: string;
  client_email?: string;
}

export interface CreateDealResponse {
  status: string;
  message: string;
  deal_id: string;
}
