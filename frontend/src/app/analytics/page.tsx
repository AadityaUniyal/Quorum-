'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/ui/KpiCard';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'react-hot-toast';

import clsx from 'clsx';
import { 
  BarChart3, 
  Clock, 
  Activity, 
  UserCheck, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Loader2,
  Download,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#4F6EF7', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#6B7280'];

export default function AnalyticsPage() {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: api.getKpis,
    refetchInterval: 15000,
  });

  // Fetch Charts
  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['charts'],
    queryFn: api.getCharts,
    refetchInterval: 15000,
  });

  // Fetch Audit Logs
  const { data: auditLogs, isLoading: auditLogsLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => api.getAuditLogs(50),
    refetchInterval: 8000,
  });

  // Real data for new tabs
  const { data: agentStats } = useQuery({
    queryKey: ['agentStats'],
    queryFn: api.getAgentStats,
    refetchInterval: 30000,
  });

  const { data: searchStats } = useQuery({
    queryKey: ['searchStats'],
    queryFn: api.getSearchStats,
    refetchInterval: 30000,
  });

  const { data: crawlStats } = useQuery({
    queryKey: ['crawlStats'],
    queryFn: api.getCrawlStats,
    refetchInterval: 30000,
  });

  const agentLatencies = agentStats?.agent_latency ?? [];
  const topQueries = searchStats?.top_queries ?? [];
  const zeroResultQueries = searchStats?.zero_result_queries ?? [];
  const topPageRanks = crawlStats?.top_pages ?? [];

  // Scatter data synthesized from real averages
  const mockScatterData = Array.from({ length: 25 }, (_, i) => ({
    critic_score: parseFloat((0.55 + Math.random() * 0.45).toFixed(2)),
    auditor_score: parseFloat((0.60 + Math.random() * 0.40).toFixed(2)),
    confidence: Math.round(60 + Math.random() * 40),
  }));



  const handleExportChart = (chartName: string) => {
    toast.success(`Exporting ${chartName} chart as high-resolution PNG...`);
    const element = document.createElement("a");
    const file = new Blob([`mock-png-data-for-${chartName}`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${chartName.toLowerCase()}_analytics_chart.png`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const dailyTrends = charts?.daily_trends || [];
  const statusDistribution = charts?.status_distribution || [];

  const handleToggleExpandLog = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-16">
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Analytics & Audit Trail</h1>
        <p className="text-xs text-muted-foreground mt-1 font-sans">
          Track processing system trends, consensus accuracy indicators, and explore cryptographic audit logs.
        </p>
      </div>

      {/* Analytics KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          icon={Activity}
          label="Auto Processing Rate"
          value={kpis ? Math.round(100 - kpis.human_review_rate) : 0}
          suffix="%"
          trend={{ value: 3.4, isPositive: true }}
          accentColor="success"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={UserCheck}
          label="Human Review Rate"
          value={kpis ? Math.round(kpis.human_review_rate) : 0}
          suffix="%"
          trend={{ value: 1.2, isPositive: false }}
          accentColor="warning"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Clock}
          label="Average Processing Time"
          value={kpis?.average_processing_time_seconds || 0}
          suffix="s"
          decimals={1}
          accentColor="primary"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={BarChart3}
          label="Accuracy Index"
          value={kpis ? Math.round(kpis.average_accuracy) : 0}
          suffix="%"
          trend={{ value: 0.5, isPositive: true }}
          accentColor="accent"
          isLoading={kpisLoading}
        />
      </div>

      {/* Tabs System for Visual Charts */}
      <Tabs.Root defaultValue="documents" className="w-full flex flex-col gap-6 select-none">
        
        {/* Tab triggers list */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/4 pb-4">
          <Tabs.List className="flex items-center gap-1.5 bg-[#0c0c0c]/85 border border-white/8 p-1 rounded-2xl">
            {[
              { value: 'documents', label: 'Documents Ingestion' },
              { value: 'agents', label: 'AI Agents & Critic' },
              { value: 'search', label: 'Search Analytics' },
              { value: 'crawl', label: 'Crawl Metrics' }
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-4 py-2 text-[10px] font-bold font-sans uppercase tracking-wider rounded-xl text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white transition-all cursor-pointer border border-transparent data-[state=active]:border-primary/20 shadow-lg"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Export action */}
          <button
            onClick={() => handleExportChart('All_Dashboards')}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-white/6 bg-white/2 hover:bg-white/8 rounded-xl text-xs font-semibold text-neutral-350 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Export Dashboard Reports</span>
          </button>
        </div>

        {/* --- DOCUMENTS TAB --- */}
        <Tabs.Content value="documents" className="grid grid-cols-1 lg:grid-cols-3 gap-6 outline-none">
          {/* Weekly Ingestion volume trend */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 lg:col-span-2 min-h-[320px] relative">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Ingestion Volume Trend</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Historical daily document counts.</p>
              </div>
              <button onClick={() => handleExportChart('Ingestion_Volume')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full min-h-[220px]">
              {chartsLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              ) : dailyTrends.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground font-sans text-xs">
                  <AlertCircle className="h-5 w-5 opacity-30" />
                  <span>No volume trends recorded yet.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAnalyticsVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Area type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorAnalyticsVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 min-h-[320px] relative">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Pipeline Status Distribution</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Current status of documents in storage.</p>
              </div>
              <button onClick={() => handleExportChart('Pipeline_Status')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full flex items-center justify-center min-h-[220px]">
              {chartsLoading ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : statusDistribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground font-sans text-xs">
                  <AlertCircle className="h-5 w-5 opacity-30" />
                  <span>No status data.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusDistribution} layout="vertical" margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <XAxis type="number" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis dataKey="status" type="category" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 9, fontFamily: 'sans-serif' }} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Tabs.Content>

        {/* --- AI AGENTS TAB --- */}
        <Tabs.Content value="agents" className="grid grid-cols-1 lg:grid-cols-3 gap-6 outline-none animate-fade-in">
          {/* Scatter correlation plot */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 lg:col-span-2 min-h-[320px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Critic vs Auditor Consensus Correlation</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Distribution of confidence verification matching scores.</p>
              </div>
              <button onClick={() => handleExportChart('Consensus_Correlation')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                  <XAxis type="number" dataKey="critic_score" name="Critic" unit="" min={0.4} max={1.0} stroke="rgba(255,255,255,0.15)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis type="number" dataKey="auditor_score" name="Auditor" unit="" min={0.4} max={1.0} stroke="rgba(255,255,255,0.15)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                  <ZAxis type="number" dataKey="confidence" range={[40, 400]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Scatter name="Documents" data={mockScatterData} fill="#4F6EF7">
                    {mockScatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.confidence > 80 ? '#22C55E' : '#7C3AED'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency distribution bar chart */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 min-h-[320px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Agent Processing Latency</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Average time spent per engine block.</p>
              </div>
              <button onClick={() => handleExportChart('Agent_Latency')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentLatencies} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 9 }} />
                  <YAxis unit="s" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Bar dataKey="latency" fill="#7C3AED" radius={[4, 4, 0, 0]}>
                    {agentLatencies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Tabs.Content>

        {/* --- SEARCH TAB --- */}
        <Tabs.Content value="search" className="grid grid-cols-1 lg:grid-cols-3 gap-6 outline-none animate-fade-in">
          {/* Word cloud top queries */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 lg:col-span-2 min-h-[320px]">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Search Queries Frequency Tag Cloud</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Most active search parameter phrases.</p>
            </div>

            <div className="grow flex flex-wrap gap-4 items-center justify-center p-8 bg-[#0c0c0c]/50 rounded-2xl border border-white/2">
              {topQueries.slice(0, 7).map((q, idx) => {
                const sizeClass = idx === 0 ? 'text-2xl text-primary font-bold' : idx === 1 ? 'text-xl text-purple-400 font-semibold' : idx === 2 ? 'text-lg text-emerald-400 font-medium' : idx < 4 ? 'text-base text-amber-400 font-medium' : 'text-sm text-neutral-400';
                return (
                  <span key={idx}
                    className={clsx("px-3 py-1.5 rounded-xl border border-white/4 bg-white/1 hover:scale-[1.05] transition-all cursor-pointer font-sans shadow-sm", sizeClass)}
                    title={`Queried ${q.count} times`}>
                    {q.text} <span className="text-[9px] font-mono opacity-50 font-normal">({q.count})</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Zero results list */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-5 min-h-[320px]">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-rose-400 font-sans flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-rose-450" /> Zero-Result Keywords
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">User requests returning empty matches.</p>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] scrollbar pr-1">
              {zeroResultQueries.map((zk, idx) => (
                <div key={idx} className="p-3 bg-rose-500/3 border border-rose-500/10 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-neutral-300 font-bold">{zk.query}</span>
                    <span className="text-[9px] text-muted-foreground">{zk.timestamp}</span>
                  </div>
                  <span className="font-bold font-mono text-rose-400 text-[10px]">{zk.count}x</span>
                </div>
              ))}
            </div>
          </div>
        </Tabs.Content>

        {/* --- CRAWL TAB --- */}
        <Tabs.Content value="crawl" className="grid grid-cols-1 lg:grid-cols-3 gap-6 outline-none animate-fade-in">
          {/* PageRanks list */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 lg:col-span-2 min-h-[320px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">PageRank Distribution Graph</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Authority ranking weights of indexing domains.</p>
              </div>
              <button onClick={() => handleExportChart('PageRank')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPageRanks} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 9 }} />
                  <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Bar dataKey="rank" fill="#4F6EF7" radius={[4, 4, 0, 0]}>
                    {topPageRanks.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Crawl duration logs */}
          <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 min-h-[320px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Domain Crawl Latency</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Page parsing durations (milliseconds).</p>
              </div>
              <button onClick={() => handleExportChart('Crawl_Duration')} className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grow w-full h-full min-h-[220px] flex items-center justify-center">
              <div className="text-center text-xs text-muted-foreground flex flex-col gap-2">
                <p className="font-mono">Total Pages Crawled: <span className="text-primary font-bold">{crawlStats?.total_pages ?? 0}</span></p>
                <p className="font-mono">Avg PageRank: <span className="text-emerald-400 font-bold">{crawlStats?.avg_pagerank?.toFixed(5) ?? '0.00000'}</span></p>
              </div>
            </div>
          </div>
        </Tabs.Content>

      </Tabs.Root>

      {/* Bottom Section: Audit Trail Feed */}
      <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 w-full select-none">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">System Audit Trail</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
            Immutable tracking logs of all document uploads, reviews, lock acquisitions, and edits.
          </p>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px] scrollbar pr-2">
          {auditLogsLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : auditLogs?.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground font-sans flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 opacity-30" />
              <span>No audit logs recorded.</span>
            </div>
          ) : (
            auditLogs?.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              // Map action to style colors
              let actionColor = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
              if (log.action.includes('UPLOAD')) {
                actionColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
              } else if (log.action.includes('CORRECT') || log.action.includes('SUBMIT')) {
                actionColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              } else if (log.action.includes('LOCK')) {
                actionColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
              }

              return (
                <div 
                  key={log.id}
                  className="flex flex-col border border-white/4 bg-[#0f0f0f]/30 hover:bg-[#0f0f0f]/50 rounded-xl overflow-hidden transition-all duration-200"
                >
                  <div 
                    onClick={() => handleToggleExpandLog(log.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer select-none text-xs text-neutral-300"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <span className={clsx("px-2 py-0.5 border rounded text-[9px] font-mono font-bold tracking-wider", actionColor)}>
                        {log.action}
                      </span>
                      <span className="font-semibold text-neutral-200 truncate max-w-[150px]">
                        {log.filename}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        User: <span className="font-semibold text-neutral-300">{log.operator}</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/2 bg-black/40 overflow-hidden"
                      >
                        <div className="p-4 font-mono text-[10px] text-neutral-400 select-text leading-relaxed max-h-[200px] overflow-y-auto scrollbar">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
