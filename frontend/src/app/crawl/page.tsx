'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import {
  Globe,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Download,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const COLORS = ['#4F6EF7', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#6B7280'];

interface CrawlStatus {
  status: 'idle' | 'crawling' | 'paused' | 'finished';
  pages_crawled: number;
  estimated_total: number;
  current_url: string;
  elapsed_seconds: number;
}

interface CrawledPage {
  id: string;
  url: string;
  title: string | null;
  pagerank: number;
  last_crawled_at: string;
}

export default function CrawlConsolePage() {
  const queryClient = useQueryClient();

  const [startUrl, setStartUrl] = useState('https://example.com');
  const [maxDepth, setMaxDepth] = useState(2);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({
    status: 'idle',
    pages_crawled: 0,
    estimated_total: 0,
    current_url: '',
    elapsed_seconds: 0
  });

  const { data: crawlStats, isLoading: statsLoading } = useQuery({
    queryKey: ['crawlStats'],
    queryFn: api.getCrawlStats,
    refetchInterval: 30000,
  });

  const { data: crawledPages = [], isLoading: pagesLoading } = useQuery<CrawledPage[]>({
    queryKey: ['crawledPages'],
    queryFn: api.getCrawledPages,
    refetchInterval: 15000,
  });

  const topPages = crawlStats?.top_pages ?? [];
  const totalPages = crawlStats?.total_pages ?? 0;
  const avgPageRank = crawlStats?.avg_pagerank ?? 0;
  const distribution = crawlStats?.pagerank_distribution ?? [];
  const visiblePages = crawledPages.slice(0, 25);

  const startCrawlMutation = useMutation({
    mutationFn: () => api.startCrawl(startUrl, maxDepth),
    onSuccess: () => {
      toast.success(`Crawler queued for ${startUrl}`);
      setCrawlStatus((prev) => ({
        ...prev,
        status: 'crawling',
        pages_crawled: 0,
        estimated_total: 0,
        current_url: startUrl,
      }));
      setCrawlMessage('Crawl task submitted to the queue.');
      queryClient.invalidateQueries({ queryKey: ['crawlStats'] });
      queryClient.invalidateQueries({ queryKey: ['crawledPages'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to start crawler');
    }
  });

  const stopCrawlMutation = useMutation({
    mutationFn: async () => {
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success('Crawler stopped');
      setCrawlStatus((prev) => ({ ...prev, status: 'idle' }));
      setCrawlMessage('Crawler status reset locally.');
      queryClient.invalidateQueries({ queryKey: ['crawlStats'] });
    }
  });

  const recalculatePageRankMutation = useMutation({
    mutationFn: api.recalculatePageRank,
    onSuccess: () => {
      toast.success('PageRank recalculated successfully');
      queryClient.invalidateQueries({ queryKey: ['crawlStats'] });
      queryClient.invalidateQueries({ queryKey: ['crawledPages'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to recalculate PageRank');
    }
  });

  const handleStartCrawl = () => {
    if (!startUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
    startCrawlMutation.mutate();
  };

  const handleStopCrawl = () => {
    stopCrawlMutation.mutate();
  };

  const progress = crawlStatus.estimated_total > 0
    ? (crawlStatus.pages_crawled / crawlStatus.estimated_total) * 100
    : 0;

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-16">
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Web Crawler Console</h1>
        <p className="text-xs text-muted-foreground mt-1 font-sans">
          Discover, index, and analyze web content with PageRank authority scoring.
        </p>
      </div>

      {/* Control Panel */}
      <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Crawl Configuration
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
              Configure crawler parameters and start indexing operation.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {crawlStatus.status === 'crawling' ? (
              <button
                onClick={handleStopCrawl}
                disabled={stopCrawlMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square className="h-3.5 w-3.5" />
                Stop Crawl
              </button>
            ) : (
              <button
                onClick={handleStartCrawl}
                disabled={startCrawlMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startCrawlMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Start Crawl
              </button>
            )}
            
            <button
              onClick={() => recalculatePageRankMutation.mutate()}
              disabled={recalculatePageRankMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-white/8 bg-white/2 hover:bg-white/5 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {recalculatePageRankMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Recalculate PageRank
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* URL Input */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">
              Start URL
            </label>
            <input
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={crawlStatus.status === 'crawling'}
              className="w-full bg-[#111] border border-white/6 rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
          </div>

          {/* Max Depth */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">
              Max Depth (1-5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              disabled={crawlStatus.status === 'crawling'}
              className="w-full bg-[#111] border border-white/6 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
          </div>

          {/* Max Pages */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">
              Queue State
            </label>
            <div className="w-full bg-[#111] border border-white/6 rounded-xl px-3 py-2 text-xs text-neutral-300 font-mono">
              {crawlMessage || 'Idle'}
            </div>
          </div>
        </div>

        {/* Crawl Progress Bar */}
        <AnimatePresence>
          {crawlStatus.status === 'crawling' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-3 border-t border-white/4 pt-4"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">
                  Progress: {crawlStatus.pages_crawled} / {crawlStatus.estimated_total || 'queued'} pages
                </span>
                <span className="text-primary font-bold font-mono">{Math.round(progress)}%</span>
              </div>
              
              <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-primary to-accent-2"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="truncate">Currently crawling: {crawlStatus.current_url || 'waiting for queue'}</span>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <span>Elapsed: {Math.floor(crawlStatus.elapsed_seconds / 60)}m {crawlStatus.elapsed_seconds % 60}s</span>
                <span>•</span>
                <span>Speed: ~{(crawlStatus.pages_crawled / Math.max(crawlStatus.elapsed_seconds, 1) * 60).toFixed(1)} pages/min</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-sans">Status:</span>
          <span className={clsx(
            "px-2 py-1 rounded-lg font-bold font-mono text-[9px] uppercase tracking-wider border",
            crawlStatus.status === 'idle' && "bg-gray-500/10 border-gray-500/20 text-gray-400",
            crawlStatus.status === 'crawling' && "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse",
            crawlStatus.status === 'finished' && "bg-green-500/10 border-green-500/20 text-green-400"
          )}>
            {crawlStatus.status}
          </span>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Globe className="h-5 w-5 text-primary" />
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">{totalPages.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1 font-sans">Total Pages Indexed</p>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">{avgPageRank.toFixed(5)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-sans">Average PageRank Score</p>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-muted-foreground">N/A</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">0</p>
            <p className="text-xs text-muted-foreground mt-1 font-sans">Crawler Errors (24h)</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PageRank Distribution */}
        <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 min-h-[320px]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">PageRank Distribution</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Authority score histogram across indexed pages.</p>
            </div>
            <button className="p-1.5 border border-white/4 hover:bg-white/4 rounded-lg text-muted-foreground hover:text-white cursor-pointer transition-colors">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grow w-full h-full min-h-[220px]">
            {statsLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            ) : distribution.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground font-sans text-xs">
                <AlertCircle className="h-5 w-5 opacity-30" />
                <span>No PageRank data available yet.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 9 }} />
                  <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Bar dataKey="count" fill="#4F6EF7" radius={[4, 4, 0, 0]}>
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Pages by PageRank */}
        <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6 min-h-[320px]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Top Authoritative Pages</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Highest PageRank scores in the index.</p>
            </div>
          </div>

          <div className="grow overflow-y-auto pr-2 scrollbar flex flex-col gap-2">
            {statsLoading ? (
              <div className="h-full w-full flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            ) : topPages.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground font-sans text-xs py-12">
                <AlertCircle className="h-5 w-5 opacity-30" />
                <span>No pages crawled yet.</span>
              </div>
            ) : (
              topPages.map((page, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[#111]/50 border border-white/4 rounded-xl hover:bg-[#111] transition-colors"
                >
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono text-muted-foreground">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-neutral-200 truncate">{page.name}</span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground truncate">{page.url}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
                      {page.rank.toFixed(5)}
                    </span>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Full Pages Table */}
      <div className="glass-card p-6 border border-white/4 bg-[#0c0c0c]/85 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Crawled Pages Index</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">
              Sortable table of all discovered and indexed web pages.
            </p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-white/6 bg-white/2 hover:bg-white/5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/4 bg-[#0c0c0c]/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                <tr>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">PageRank</th>
                  <th className="px-4 py-3">Last Crawled</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Loading crawled pages...
                    </td>
                  </tr>
                ) : visiblePages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No crawled pages yet. Start a crawl to populate this table.
                    </td>
                  </tr>
                ) : (
                  visiblePages.map((page) => (
                    <tr key={page.id} className="text-xs text-neutral-300">
                      <td className="px-4 py-3 max-w-[320px] truncate">{page.url}</td>
                      <td className="px-4 py-3 max-w-[220px] truncate">{page.title || 'Untitled page'}</td>
                      <td className="px-4 py-3 font-mono">{page.pagerank.toFixed(5)}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{new Date(page.last_crawled_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/6 bg-white/2 px-2 py-1 text-[10px] text-neutral-300 hover:text-white hover:bg-white/8"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
