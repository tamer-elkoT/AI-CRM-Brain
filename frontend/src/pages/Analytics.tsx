import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, userApi } from '../services/api';
import type { AnalyticsResponse } from '../types';

function getStartOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Analytics() {
  // ── Date Range State ──
  // Default: from the 1st of the current month to today
  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getToday());

  // ── Data Fetching ──
  // 1. Fetch current user to check if they are a manager
  const { data: user } = useQuery({
    queryKey: ['user_me'],
    queryFn: userApi.getMe,
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  // 2. Fetch analytics
  const { data: analytics, isLoading, isError, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ['analytics', startDate, endDate],
    queryFn: () => analyticsApi.getAnalytics(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  return (
    <>
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Analytics Dashboard</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Performance and KPIs</p>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 flex flex-col space-y-gutter md:space-y-6 pb-12">
        
        {/* ── Date Filter Bar ── */}
        <form onSubmit={handleFilter} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row items-end md:items-center gap-4 shadow-sm">
          <div className="flex flex-col w-full md:w-auto">
            <label className="font-label-sm text-on-surface-variant mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-auto">
            <label className="font-label-sm text-on-surface-variant mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full md:w-auto bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            Apply Filter
          </button>
        </form>

        {/* ── Loading / Error States ── */}
        {isLoading && (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        )}
        
        {isError && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error/20">
            Failed to load analytics data. Please try again.
          </div>
        )}

        {/* ── KPI Cards ── */}
        {!isLoading && !isError && analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              
              <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6 relative overflow-hidden group hover:shadow-level-2 transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-6xl">work</span>
                </div>
                <div className="relative z-10">
                  <p className="font-label-md text-on-surface-variant mb-2 uppercase tracking-wider">Active Deals</p>
                  <p className="font-display-md text-on-surface">{analytics.active_deals}</p>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6 relative overflow-hidden group hover:shadow-level-2 transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-secondary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-6xl">check_circle</span>
                </div>
                <div className="relative z-10">
                  <p className="font-label-md text-on-surface-variant mb-2 uppercase tracking-wider">Closed Deals</p>
                  <p className="font-display-md text-on-surface">{analytics.closed_deals}</p>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6 relative overflow-hidden group hover:shadow-level-2 transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-tertiary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-6xl">forum</span>
                </div>
                <div className="relative z-10">
                  <p className="font-label-md text-on-surface-variant mb-2 uppercase tracking-wider">Total Follow-ups</p>
                  <p className="font-display-md text-on-surface">{analytics.total_followups}</p>
                </div>
              </div>

            </div>

            {/* ── Manager Leaderboard ── */}
            {user?.role === 'sales_manager' && analytics.leaderboard && (
              <div className="mt-8">
                <h3 className="font-title-lg text-on-surface mb-4 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-primary">leaderboard</span>
                  Sales Rep Leaderboard
                </h3>
                <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant">
                          <th className="p-4 font-label-md text-on-surface-variant">Rank</th>
                          <th className="p-4 font-label-md text-on-surface-variant">Sales Rep</th>
                          <th className="p-4 font-label-md text-on-surface-variant">Closed Deals</th>
                          <th className="p-4 font-label-md text-on-surface-variant">Follow-ups</th>
                          <th className="p-4 font-label-md text-on-surface-variant">Avg AI Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.leaderboard.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-on-surface-variant font-body-md">
                              No performance data found for the selected period.
                            </td>
                          </tr>
                        ) : (
                          analytics.leaderboard.map((entry, idx) => (
                            <tr key={entry.rep_name} className="border-b border-outline-variant/50 hover:bg-surface-variant/20 transition-colors">
                              <td className="p-4 font-body-md text-on-surface flex items-center">
                                {idx === 0 ? <span className="material-symbols-outlined text-yellow-500 mr-2">emoji_events</span> : 
                                 idx === 1 ? <span className="material-symbols-outlined text-gray-400 mr-2">military_tech</span> : 
                                 idx === 2 ? <span className="material-symbols-outlined text-amber-700 mr-2">military_tech</span> : 
                                 <span className="w-6 inline-block text-center mr-2">{idx + 1}</span>}
                              </td>
                              <td className="p-4 font-label-lg text-on-surface">{entry.rep_name}</td>
                              <td className="p-4 font-body-md text-on-surface">{entry.closed_deals}</td>
                              <td className="p-4 font-body-md text-on-surface">{entry.followup_count}</td>
                              <td className="p-4 font-body-md text-on-surface">{entry.avg_ai_score}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
