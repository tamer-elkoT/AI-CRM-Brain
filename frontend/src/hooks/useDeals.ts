import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, actionApi } from '../services/api';
import type { DashboardResponse, DealDetail, ActionResponse, SyncResponse, AccountRankingResponse } from '../types';

export function useDashboard(sortBy: string = 'ai_score', limit?: number) {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', sortBy, limit],
    queryFn: () => dashboardApi.getRankedDeals(sortBy, limit),
  });
}

export function useAccountRanking() {
  return useQuery<AccountRankingResponse>({
    queryKey: ['account_ranking'],
    queryFn: dashboardApi.getAccountRanking,
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
    },
  });
}
