'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/ui/KpiCard';
import { IOSSegmentedControl } from '@/components/ui/IOSSegmentedControl';
import { IOSActivityRings } from '@/components/ui/IOSActivityRings';
import { IOSDocumentDropzone } from '@/components/ui/IOSDocumentDropzone';
import { iosAudio } from '@/lib/iosAudio';
import { toast } from 'react-hot-toast';
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
  ShieldCheck,
  Sparkles,
  Inbox,
  Clock,
  ExternalLink,
  Layers,
  ArrowUpRight
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
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#0071e3', '#30D158', '#FF9F0A', '#AF52DE', '#FF453A', '#64D2FF'];

// Custom Area Chart Tooltip (Apple Style)
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#121217]/95 border border-white/15 p-3 rounded-2xl shadow-2xl backdrop-blur-xl text-white">
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-blue-400 font-mono">{payload[0].value}</span>
          <span className="text-[11px] text-zinc-300 font-sans">verified documents</span>
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
  const queryClient = useQueryClient();
  const [timeframe, setTimeframe] = useState<'today' | '7d' | '30d'>('7d');
  const [isUploading, setIsUploading] = useState(false);

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
    queryFn: () => api.getAuditLogs(8),
    refetchInterval: 10000,
  });

  // Upload handler for instant dropzone
  const handleFilesAccepted = async (files: File[]) => {
    setIsUploading(true);
    let successCount = 0;
    try {
      for (const file of files) {
        await api.uploadDocument(file);
        successCount++;
      }
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['charts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(`Successfully queued ${successCount} document${successCount > 1 ? 's' : ''} for multi-agent audit`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document batch');
    } finally {
      setIsUploading(false);
    }
  };

  const weeklyVolume = charts?.daily_trends || [];
  const categoryDistribution = charts?.category_distribution || [];

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-20 p-4 sm:p-6 lg:p-8 text-white font-sans">
      
      {/* Top Apple Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              Operations &amp; Verification Hub
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              7-Agent Consensus
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-light">
            Real-time financial document auditing, deterministic decimal verification, and certified ERP sync.
          </p>
        </div>

        {/* Timeframe Segmented Selector & Status */}
        <div className="flex items-center gap-3">
          <IOSSegmentedControl
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: '7 Days' },
              { value: '30d', label: '30 Days' },
            ]}
            value={timeframe}
            onChange={(val) => setTimeframe(val as any)}
            size="sm"
          />

          <div className="hidden sm:flex items-center gap-2 bg-[#121217]/80 border border-white/[0.08] px-3.5 py-1.5 rounded-full shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 pulse-dot bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-zinc-300">
              Cluster: Optimal
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section: Quick Document Dropzone + Activity Concentric Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <IOSDocumentDropzone
            onFilesAccepted={handleFilesAccepted}
            isUploading={isUploading}
            className="h-full min-h-[220px]"
          />
        </div>

        <div className="lg:col-span-5 p-6 rounded-3xl ios-glass-card flex flex-col justify-between">
          <IOSActivityRings
            accuracy={kpis?.average_accuracy || 99.8}
            consensus={98.4}
            slaSpeed={96.2}
            size={160}
          />
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <KpiCard
          icon={FileText}
          label="Documents Indexed"
          value={kpis?.total_documents || 0}
          trend={{ value: 14.8, isPositive: true }}
          accentColor="primary"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Target}
          label="OCR Accuracy Score"
          value={kpis?.average_accuracy || 0}
          suffix="%"
          decimals={1}
          trend={{ value: 0.9, isPositive: true }}
          accentColor="success"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Eye}
          label="Pending Review Queue"
          value={kpis?.pending_review || 0}
          trend={{ value: 3.5, isPositive: false }}
          accentColor="warning"
          isLoading={kpisLoading}
        />
        <KpiCard
          icon={Zap}
          label="Multi-Agent Latency"
          value={kpis?.average_processing_time_seconds || 0}
          suffix="s"
          decimals={1}
          accentColor="accent"
          isLoading={kpisLoading}
        />
      </div>

      {/* Quick Action Navigation Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {[
          {
            title: 'Document Library',
            subtitle: 'Batch table, grid cards, and live OCR status',
            href: '/documents',
            icon: FileText,
            color: 'text-blue-400',
          },
          {
            title: 'Spatial Review Studio',
            subtitle: 'Interactive 2D bounding boxes & 3-way match',
            href: '/review',
            icon: Eye,
            color: 'text-amber-400',
          },
          {
            title: 'Neural Hybrid Search',
            subtitle: 'Vector embeddings + keyword search citations',
            href: '/search',
            icon: Search,
            color: 'text-purple-400',
          },
          {
            title: 'Accuracy Benchmarks',
            subtitle: 'Empirical comparison vs AWS Textract & raw LLMs',
            href: '/benchmarks',
            icon: BarChart3,
            color: 'text-emerald-400',
          },
        ].map((action) => (
          <Link
            key={action.title}
            href={action.href}
            onClick={() => iosAudio.playTap()}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#121217]/80 hover:bg-[#181822] p-5 transition-all duration-300 shadow-lg cursor-pointer flex flex-col justify-between touch-press"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                  <action.icon className={clsx("h-4 w-4", action.color)} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1 font-light leading-relaxed">
                {action.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Visuals: Charts & Live Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ingestion Telemetry Area Chart */}
        <div className="rounded-3xl p-6 border border-white/[0.08] bg-[#121217]/80 backdrop-blur-2xl flex flex-col justify-between lg:col-span-2 min-h-[340px] shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Ingestion &amp; Verification Telemetry</span>
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Daily Records</span>
            </div>
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
                      <stop offset="5%" stopColor="#0071e3" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0071e3" stopOpacity={0.0}/>
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
                    stroke="#0071e3" 
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
        <div className="rounded-3xl p-6 border border-white/[0.08] bg-[#121217]/80 backdrop-blur-2xl flex flex-col justify-between min-h-[340px] shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Document Classification
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Distribution</span>
            </div>
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
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={4}
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

      {/* Live Operational Audit Feed */}
      <div className="rounded-3xl p-6 border border-white/[0.08] bg-[#121217]/80 backdrop-blur-2xl shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-white/[0.05] text-white border border-white/10">
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Live Multi-Agent Audit Log
              </h3>
              <p className="text-[11px] text-zinc-400">
                Timestamped consensus logs, deterministic arithmetic passes, and ERP exports
              </p>
            </div>
          </div>

          <Link
            href="/documents"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            <span>View All in Library</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="mt-4 divide-y divide-white/[0.06]">
          {auditLogsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No recent audit events. Ingest a document to trigger the 7-agent pipeline.
            </div>
          ) : (
            auditLogs.map((log: any, index: number) => (
              <div
                key={log.id || index}
                className="py-3 flex items-center justify-between gap-4 text-xs hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-white truncate">
                      {log.action || log.message || 'Verification complete'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {log.details || log.entity_type || 'Document verified by OCR & Reconciliation Agents'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : 'just now'}
                  </span>
                  <Link
                    href={`/review?doc_id=${log.document_id || ''}`}
                    onClick={() => iosAudio.playTap()}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                    title="Inspect in Review Studio"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
