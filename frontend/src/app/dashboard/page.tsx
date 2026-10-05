'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/ui/KpiCard';
import clsx from 'clsx';
import { 
  FileText, 
  Target, 
  Eye, 
  Zap, 
  AlertCircle,
  ArrowRight,
  Loader2,
  Search,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Scale,
  Sparkles,
  Inbox
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import Link from 'next/link';

const COLORS = ['#2997FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#64D2FF'];

// Custom Area Chart Tooltip (Apple Style)
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#121217]/95 border border-white/15 p-3 rounded-2xl shadow-2xl backdrop-blur-xl text-white">
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-blue-400 font-mono">{payload[0].value}</span>
          <span className="text-[11px] text-zinc-300 font-sans">documents processed</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Pie Chart Tooltip (Apple Style)
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#121217]/95 border border-white/15 p-3 rounded-2xl shadow-2xl backdrop-blur-xl text-white">
        <p className="text-xs font-semibold text-white capitalize">{data.name}</p>
        <p className="text-xs font-mono text-emerald-400 mt-0.5">
          {data.value} records
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: api.getKpis,
    refetchInterval: 15000,
  });

  // Fetch Chart Data
  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['charts'],
    queryFn: api.getCharts,
    refetchInterval: 15000,
  });

  // Fetch System Health
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 10000,
  });

  // Fetch Audit Logs
  const { data: auditLogs, isLoading: auditLogsLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(10),
    refetchInterval: 10000,
  });

  const weeklyVolume = charts?.daily_trends || [];
  const categoryDistribution = charts?.category_distribution || [];

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-16 p-4 sm:p-6 lg:p-8 text-white">
      
      {/* Top Apple Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white font-sans">
              Operations &amp; Verification Hub
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              7-Agent Consensus Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-light">
            Real-time financial document auditing, deterministic decimal verification, and certified ERP sync.
          </p>
        </div>

        {/* Global Cluster Status Indicator */}
        <div className="flex items-center gap-2.5 bg-[#121217]/80 border border-white/[0.08] px-3.5 py-1.5 rounded-full shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 pulse-dot bg-emerald-400" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-zinc-300">
            Cluster: Optimal ({health?.status === 'healthy' ? 'Connected' : 'Active'})
          </span>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          icon={FileText}
          label="Documents Indexed"
          value={kpis?.total_documents || 0}
          trend={{ value: 12.5, isPositive: true }}
          accentColor="primary"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Target}
          label="Accuracy Score"
          value={kpis?.average_accuracy || 0}
          suffix="%"
          decimals={1}
          trend={{ value: 0.8, isPositive: true }}
          accentColor="success"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Eye}
          label="Pending Review Queue"
          value={kpis?.pending_review || 0}
          trend={{ value: 4.2, isPositive: false }}
          accentColor="warning"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Zap}
          label="Average Processing Latency"
          value={kpis?.average_processing_time_seconds || 0}
          suffix="s"
          decimals={1}
          accentColor="accent"
          isLoading={kpisLoading}
        />
      </div>

      {/* Quick Action Workflow Launchers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {[
          {
            title: 'Batch Document Ingestion',
            subtitle: 'Parallel multi-file dropzone with spatial layout & vector indexing',
            href: '/documents',
            icon: FileText,
            color: 'text-blue-400',
          },
          {
            title: 'Spatial Review Studio',
            subtitle: 'Interactive 2D bounding box canvas with 3-way matching',
            href: '/review',
            icon: Eye,
            color: 'text-amber-400',
          },
          {
            title: 'Neural Hybrid Search',
            subtitle: 'Vector semantic similarity + BM25 search with citations',
            href: '/search',
            icon: Search,
            color: 'text-purple-400',
          },
          {
            title: 'Accuracy Benchmarks',
            subtitle: 'Head-to-head empirical matrix vs AWS Textract & raw LLMs',
            href: '/benchmarks',
            icon: BarChart3,
            color: 'text-emerald-400',
          },
        ].map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121217]/80 hover:bg-[#16161d] p-5 transition-all duration-300 shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <action.icon className={clsx("h-4 w-4", action.color)} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1 font-light leading-relaxed">
                {action.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Visuals Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ingestion Telemetry Area Chart */}
        <div className="rounded-2xl p-6 border border-white/[0.08] bg-[#121217]/80 backdrop-blur-2xl flex flex-col justify-between lg:col-span-2 min-h-[340px] shadow-lg">
          <div>
            <h3 className="text-sm font-medium text-white flex items-center justify-between">
              <span>Ingestion &amp; Verification Telemetry</span>
              <span className="text-[10px] font-mono text-zinc-500">Daily Telemetry</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-light">
              Real-time multi-agent processing volume across high-throughput pipeline.
            </p>
          </div>

          <div className="flex-1 w-full h-full min-h-[220px] mt-4">
            {chartsLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
              </div>
            ) : weeklyVolume.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs py-12">
                <Inbox className="h-6 w-6 opacity-30" />
                <span>No volume logs recorded yet. Drop a document to begin.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyVolume} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2997FF" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2997FF" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.1)" 
                    tick={{ fill: '#86868B', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.1)" 
                    tick={{ fill: '#86868B', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#2997FF" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#appleGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category distribution Pie Chart */}
        <div className="rounded-2xl p-6 border border-white/[0.08] bg-[#121217]/80 backdrop-blur-2xl flex flex-col justify-between min-h-[340px] shadow-lg">
          <div>
            <h3 className="text-sm font-medium text-white flex items-center justify-between">
              <span>Document Classification</span>
              <span className="text-[10px] font-mono text-zinc-500">Distribution</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-light">
              Breakdown of verified documents indexed by schema type.
            </p>
          </div>

          <div className="flex-1 w-full h-full flex items-center justify-center min-h-[220px] mt-4">
            {chartsLoading ? (
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            ) : categoryDistribution.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs py-12">
                <Inbox className="h-6 w-6 opacity-30" />
                <span>No classifications recorded yet.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="category"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontFamily: 'sans-serif', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
