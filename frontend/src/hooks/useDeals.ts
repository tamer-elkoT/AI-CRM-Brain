import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, actionApi } from '../services/api';
import type { DashboardResponse, DealDetail, ActionResponse, SyncResponse, AccountRankingResponse, GenerateResponse, AllDealsResponse, DealCreate, CreateDealResponse } from '../types';

export function useDashboard(sortBy: string = 'ai_score', limit?: number) {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', sortBy, limit],
    queryFn: () => dashboardApi.getRankedDeals(sortBy, limit),
  });
}

export function useAllDeals(page: number = 1, pageSize: number = 20, search?: string, sortBy: string = 'ai_score') {
  return useQuery<AllDealsResponse>({
    queryKey: ['all_deals', page, pageSize, search, sortBy],
    queryFn: () => dashboardApi.getAllDeals(page, pageSize, search, sortBy),
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
    },
  });
}
