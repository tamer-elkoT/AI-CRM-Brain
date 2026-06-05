import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../services/api';
import type { NotificationListResponse, ActionResponse } from '../types';

export function useNotifications(page: number = 1, pageSize: number = 20) {
  return useQuery<NotificationListResponse>({
    queryKey: ['notifications', page, pageSize],
    queryFn: () => notificationApi.getNotifications(page, pageSize),
    refetchInterval: 60000, // Poll every 60 seconds
  });
}

export function useUnreadCount() {
  return useQuery<{ unread_count: number }>({
    queryKey: ['notifications_unread'],
    queryFn: notificationApi.getUnreadCount,
    refetchInterval: 60000, // Poll every 60 seconds for badge
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error, number>({
    mutationFn: (notificationId: number) => notificationApi.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications_unread'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error>({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications_unread'] });
    },
  });
}
