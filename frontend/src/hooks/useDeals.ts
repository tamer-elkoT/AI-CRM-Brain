import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, actionApi, followupApi } from '../services/api';
import type { DashboardResponse, DealDetail, ActionResponse, SyncResponse, AccountRankingResponse, GenerateResponse, AllDealsResponse, DealCreate, CreateDealResponse, FollowupMarkRequest, FollowupMarkResponse, GenerateMessageResponse, StageUpdateResponse } from '../types';

export function useDashboard(sortBy: string = 'ai_score', limit?: number) {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', sortBy, limit],
    queryFn: () => dashboardApi.getRankedDeals(sortBy, limit),
  });
}

export function useAllDeals(page: number = 1, pageSize: number = 20, search?: string, sortBy: string = 'ai_score', includeClosed: boolean = false) {
  return useQuery<AllDealsResponse>({
    queryKey: ['all_deals', page, pageSize, search, sortBy, includeClosed],
    queryFn: () => dashboardApi.getAllDeals(page, pageSize, search, sortBy, includeClosed),
  });
}

export function useAccountRanking() {
  return useQuery<AccountRankingResponse>({
    queryKey: ['account_ranking'],
    queryFn: dashboardApi.getAccountRanking,
  });
}

export function useAccountNames() {
  return useQuery<string[]>({
    queryKey: ['account_names'],
    queryFn: dashboardApi.getAccountNames,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDealDetail(dealId: string | null) {
  return useQuery<DealDetail>({
    queryKey: ['deal', dealId],
    queryFn: () => dashboardApi.getDealDetail(dealId!),
    enabled: !!dealId,
  });
}

export function useMarkActioned() {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error, string>({
    mutationFn: (dealId: string) => actionApi.markActioned(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useEscalateDeal() {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error, string>({
    mutationFn: (dealId: string) => actionApi.escalateDeal(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation<SyncResponse, Error>({
    mutationFn: actionApi.triggerSync,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['account_ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation<CreateDealResponse, Error, DealCreate>({
    mutationFn: (data: DealCreate) => dashboardApi.createDeal(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient();
  return useMutation<GenerateResponse, Error>({
    mutationFn: actionApi.generateRecommendations,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['account_ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['deal'] });
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
    },
  });
}

// ============================================================
// Sprint 5: Follow-up & Stage Hooks
// ============================================================

export function useMarkFollowedUp() {
  const queryClient = useQueryClient();
  return useMutation<FollowupMarkResponse, Error, { dealId: string; data?: FollowupMarkRequest }>({
    mutationFn: ({ dealId, data }) => followupApi.markFollowedUp(dealId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
      void queryClient.invalidateQueries({ queryKey: ['deal'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useGenerateMessage() {
  return useMutation<GenerateMessageResponse, Error, { dealId: string; salesRepName?: string }>({
    mutationFn: ({ dealId, salesRepName }) => followupApi.generateMessage(dealId, salesRepName),
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation<StageUpdateResponse, Error, { dealId: string; newStage: string }>({
    mutationFn: ({ dealId, newStage }) => dashboardApi.updateStage(dealId, newStage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
      void queryClient.invalidateQueries({ queryKey: ['deal'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateFollowupDays() {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error, { dealId: string; days: number }>({
    mutationFn: ({ dealId, days }) => followupApi.updateDays(dealId, days),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
    },
  });
}

// ============================================================
// Epic 2: Delete Deal & Inline Contact Edit Hooks
// ============================================================

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; message: string; deal_id: string }, Error, string>({
    mutationFn: (dealId: string) => dashboardApi.deleteDeal(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateDealContact() {
  const queryClient = useQueryClient();
  return useMutation<
    { status: string; message: string; deal_id: string; client_phone: string | null; client_email: string | null },
    Error,
    { dealId: string; client_phone?: string | null; client_email?: string | null }
  >({
    mutationFn: ({ dealId, ...data }) => dashboardApi.updateDealContact(dealId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['deal', variables.dealId] });
      void queryClient.invalidateQueries({ queryKey: ['all_deals'] });
    },
  });
}
