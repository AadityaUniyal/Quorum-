'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, SearchResultItem } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { 
  SearchIcon, 
  MessageSquare, 
  Send, 
  Sparkles, 
  Loader2, 
  FileText,
  AlertCircle,
  CheckSquare,
  Square,
  Globe,
  Filter,
  X,
  Bookmark,
  Download,
  Trash2,
  BookmarkCheck,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const placeholders = [
  "Search 'Stellar Dynamics titanium rods prices'...",
  "Search 'breach rules in contract agreement'...",
  "Search 'vendors with invoice amount > $20k'...",
  "Search 'expiration dates on compliance certificates'..."
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: { id: string; name: string }[];
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword' | 'hybrid'>('semantic');
  const [category, setCategory] = useState('');
  const [minScore, setMinScore] = useState<number>(0); // relevance threshold (0-100)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Cycling Placeholder State
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // RAG Chat state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Milestone 3 states: Query Expansion, Bookmarks, Export
  const [expandActive, setExpandActive] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);

  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isSaveBookmarkModalOpen, setIsSaveBookmarkModalOpen] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const list = await api.listBookmarks();
      setBookmarks(list);
    } catch (e) {
      console.error('Failed to load bookmarks', e);
    }
  };

  const handleSaveBookmark = async () => {
    if (!query.trim()) {
      toast.error('Search query is empty');
      return;
    }
    const name = bookmarkName.trim() || `Search: "${query.trim()}"`;
    try {
      await api.createBookmark(name, query.trim(), { category, minScore });
      toast.success('Bookmark saved!');
      setBookmarkName('');
      setIsSaveBookmarkModalOpen(false);
      fetchBookmarks();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save bookmark');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await api.deleteBookmark(id);
      toast.success('Bookmark deleted');
      fetchBookmarks();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete bookmark');
    }
  };

  const handleApplyBookmark = (bm: any) => {
    setQuery(bm.query_text);
    if (bm.filters?.category) setCategory(bm.filters.category);
    if (bm.filters?.minScore !== undefined) setMinScore(bm.filters.minScore);
    setIsBookmarksOpen(false);
    setHasSearched(true);
    setTimeout(() => refetch(), 50);
  };

  const handleExportResults = async (format: 'csv' | 'pdf') => {
    if (!query.trim()) {
      toast.error('No active query to export');
      return;
    }
    setIsExporting(true);
    try {
      const scoreParam = minScore > 0 ? minScore / 100 : undefined;
      const blob = await api.exportSearchResults(query, format, category || undefined, undefined, scoreParam);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search_results.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported search results as ${format.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e.message || `Export to ${format.toUpperCase()} failed`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerExpandQuery = async () => {
    if (!query.trim()) {
      toast.error('Enter a query first');
      return;
    }
    try {
      const res = await api.expandQuery(query);
      setExpandedQueries(res.expanded_queries);
      setExpandActive(true);
      toast.success(`Generated ${res.expanded_queries.length} query variants`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to expand query');
    }
  };

  // Search Query via React Query
  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['search', query, category, searchMode, expandActive],
    queryFn: async () => {
      if (!query.trim()) return [];
      if (searchMode === 'semantic') {
        return api.searchSemantic(query, category || undefined);
      } else if (searchMode === 'keyword') {
        const scoreParam = minScore > 0 ? minScore / 100 : undefined;
        return api.searchMetadata(query, category || undefined, undefined, scoreParam, expandActive);
      } else {
        const scoreParam = minScore > 0 ? minScore / 100 : undefined;
        return api.searchMetadata(query, category || undefined, undefined, scoreParam, expandActive);
      }
    },
    enabled: false, // Only trigger manually
  });

  const handleInputChange = async (val: string) => {
    setQuery(val);
    if (val.trim().length > 1) {
      try {
        const sugs = await api.searchSuggest(val);
        setSuggestions(sugs);
        setShowSuggestions(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (sug: string) => {
    setQuery(sug);
    setSuggestions([]);
    setShowSuggestions(false);
    setHasSearched(true);
    setTimeout(() => {
      refetch();
    }, 50);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    setSuggestions([]);
    setShowSuggestions(false);
    setHasSearched(true);
    if (expandActive) {
      try {
        const exp = await api.expandQuery(query);
        setExpandedQueries(exp.expanded_queries);
      } catch (e) {
        console.error(e);
      }
    }
    refetch();
  };

  const handleToggleDocSelect = (docId: string) => {
    setSelectedDocIds((prev) => {
      const isSelected = prev.includes(docId);
      const nextList = isSelected ? prev.filter((id) => id !== docId) : [...prev, docId];
      if (nextList.length > 0) {
        setIsChatOpen(true);
      } else {
        setIsChatOpen(false);
      }
      return nextList;
    });
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput;
    setChatHistory((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Add a placeholder message for the assistant's response
      setChatHistory((prev) => [...prev, { role: 'assistant', content: '' }]);

      const history = chatHistory.map(m => ({ role: m.role, content: m.content }));
      const response = await api.fetchRagStream(selectedDocIds, userMessage, undefined, history);
      
      if (!response.body) {
        throw new Error('No readable stream in response body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let currentText = '';
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.type === 'token') {
                currentText += payload.content;
                setChatHistory((prev) => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content: currentText
                    };
                  }
                  return copy;
                });
              } else if (payload.type === 'citations') {
                const mappedCitations = (payload.citations || []).map((c: any) => ({
                  id: c.document_id,
                  name: c.filename,
                  quote: c.quote
                }));
                setChatHistory((prev) => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      citations: mappedCitations
                    };
                  }
                  return copy;
                });
              }
            } catch (err) {
              // Ignore partial JSON line errors
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to get answer from AI copilot');
      setChatHistory((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
          copy[copy.length - 1].content = 'Sorry, I encountered an error while indexing the knowledgebase context.';
        } else {
          copy.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error while indexing the knowledgebase context.'
          });
        }
        return copy;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExportChatToPDF = () => {
    if (chatHistory.length === 0) {
      toast.error('No chat history to export');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>RAG Copilot Chat Export</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #fff; color: #111; line-height: 1.6; }
              h1 { font-size: 20px; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 5px; }
              .msg { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 12px; }
              .user { background: #f7f7f8; }
              .assistant { background: #f0f4ff; border-color: #dbeafe; }
              .header { margin-bottom: 30px; font-size: 11px; color: #666; font-family: monospace; }
              .citations { margin-top: 10px; font-size: 10px; color: #555; border-top: 1px dashed #ddd; pt: 5px; }
            </style>
          </head>
          <body>
            <h1>RAG Chat Session Export</h1>
            <div class="header">Exported on: ${new Date().toLocaleString()}</div>
            ${chatHistory.map(m => `
              <div class="msg ${m.role}">
                <strong>[${m.role.toUpperCase()}]</strong>
                <p>${m.content.replace(/\n/g, '<br/>')}</p>
                ${m.citations && m.citations.length > 0 ? `
                  <div class="citations">
                    <strong>Cited Sources:</strong> ${m.citations.map(c => c.name).join(', ')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
      toast.success('Generated printable chat export document!');
    }
  };

  const clearSearch = () => {
    setQuery('');
    setHasSearched(false);
    setSelectedDocIds([]);
    setIsChatOpen(false);
    setChatHistory([]);
  };

  // Filtered results client-side by score slider (if active)
  const filteredResults = results?.filter(item => {
    const itemScore = item.score !== undefined && item.score !== null 
      ? item.score * 100 
      : (item.consensus_score !== null ? item.consensus_score * 100 : 100);
    return itemScore >= minScore;
  }) || [];

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] w-full max-w-7xl mx-auto select-none overflow-hidden relative">
      
      {/* Search Layout Grid */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        <AnimatePresence mode="wait">
          {!hasSearched ? (
            // --- FIRST LOAD: LARGE CENTERED SEARCH BAR ---
            <motion.div
              key="centered-search"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full gap-8 select-none py-12"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-accent-2 text-white shadow-lg shadow-primary/20">
                  <SearchIcon className="h-6 w-6 animate-pulse" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">Cognitive RAG Search</h1>
                <p className="text-xs text-muted-foreground max-w-md font-sans">
                  Query indexing models semantically or filter properties directly using metadata parameters.
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="w-full relative flex flex-col gap-4">
                <div className="flex items-center gap-3 bg-[#0c0c0c]/85 border border-white/8 focus-within:border-primary/50 focus-within:shadow-primary/5 p-3.5 pl-5 rounded-2xl shadow-2xl transition-all duration-300">
                  <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="relative grow">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder={placeholders[placeholderIdx]}
                      className="w-full bg-transparent border-0 text-neutral-200 placeholder-neutral-500 text-sm focus:outline-none focus:ring-0 font-sans"
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-[-20px] right-[-20px] mt-4.5 bg-[#0c0c0c]/95 border border-white/6 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl max-h-[220px] overflow-y-auto scrollbar">
                        {suggestions.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectSuggestion(sug)}
                            className="w-full text-left px-5 py-3 text-xs text-neutral-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-white/2 last:border-b-0 cursor-pointer flex items-center gap-2 font-sans"
                          >
                            <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mode Pills + Category Filter Chips + Expansion & Bookmarks */}
                <div className="flex flex-col gap-4 px-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 bg-[#111] p-1 rounded-xl border border-white/4">
                      {[
                        { label: 'Semantic (AI)', value: 'semantic' },
                        { label: 'Keyword (ts_rank_cd)', value: 'keyword' },
                        { label: 'Hybrid', value: 'hybrid' }
                      ].map(mode => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setSearchMode(mode.value as typeof searchMode)}
                          className={clsx(
                            "px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-all duration-200",
                            searchMode === mode.value ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandActive(!expandActive);
                          if (!expandActive && query.trim()) handleTriggerExpandQuery();
                        }}
                        className={clsx(
                          "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer",
                          expandActive ? "bg-primary/20 border-primary/40 text-primary" : "bg-[#111] border-white/4 text-neutral-400 hover:text-white"
                        )}
                        title="Query Expansion via LLM"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Expand Query (AI)
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsBookmarksOpen(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#111] border border-white/4 text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> Bookmarks ({bookmarks.length})
                      </button>
                    </div>
                  </div>

                  {/* Paraphrase Chips */}
                  {expandActive && expandedQueries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-xs">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                      <span className="font-mono text-[10px] uppercase font-bold text-neutral-300">Expanded Paraphrases:</span>
                      {expandedQueries.map((eq, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono text-[10px]">
                          "{eq}"
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'All Chunks', value: '' },
                      { label: 'Invoices', value: 'INVOICE' },
                      { label: 'RFQs', value: 'RFQ' },
                      { label: 'Contracts', value: 'CONTRACT' },
                      { label: 'Compliance', value: 'COMPLIANCE' },
                      { label: 'Purchase Orders', value: 'PURCHASE_ORDER' }
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={clsx(
                          "px-3 py-1.5 rounded-xl text-xs transition-all duration-200 border cursor-pointer",
                          category === cat.value
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold shadow-md"
                            : "bg-[#111]/80 border-white/4 text-neutral-400 hover:text-neutral-200"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            // --- SEARCHED VIEW: COMPACT HEADER + DOUBLE COLUMN LAYOUT ---
            <motion.div
              key="searched-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col gap-6 overflow-hidden animate-fade-in"
            >
              {/* Compact Header search bar */}
              <div className="flex flex-col gap-3.5 bg-[#0c0c0c]/85 border border-white/4 p-4 rounded-2xl shadow-md">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
                  <SearchIcon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Search query parameter..."
                    className="flex-1 bg-transparent border-0 text-neutral-200 placeholder-neutral-500 text-xs focus:outline-none focus:ring-0 font-sans"
                  />
                  
                  {/* Mode switcher inside search bar wrapper */}
                  <div className="flex items-center gap-1 bg-[#111] p-0.5 rounded-lg border border-white/4 shrink-0">
                    {[
                      { label: 'Semantic', value: 'semantic' },
                      { label: 'Full-Text', value: 'keyword' },
                      { label: 'Hybrid', value: 'hybrid' }
                    ].map(mode => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => {
                          setSearchMode(mode.value as typeof searchMode);
                          setTimeout(() => refetch(), 50);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-all",
                          searchMode === mode.value ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-primary-hover transition-colors shrink-0"
                  >
                    Search
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExpandActive(!expandActive);
                      if (!expandActive && query.trim()) handleTriggerExpandQuery();
                    }}
                    className={clsx(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer shrink-0",
                      expandActive ? "bg-primary/20 border-primary/40 text-primary" : "bg-[#111] border-white/4 text-neutral-400 hover:text-white"
                    )}
                    title="Toggle Query Expansion (AI)"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSaveBookmarkModalOpen(true)}
                    className="p-1.5 rounded-lg border border-white/4 bg-[#111] text-neutral-300 hover:text-primary cursor-pointer transition-colors shrink-0"
                    title="Save Search Bookmark"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBookmarksOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-white/4 bg-[#111] text-neutral-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer shrink-0"
                    title="Saved Bookmarks"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> ({bookmarks.length})
                  </button>

                  <div className="h-5 w-px bg-white/6 shrink-0" />

                  <button
                    type="button"
                    onClick={() => handleExportResults('csv')}
                    disabled={isExporting}
                    className="px-2.5 py-1.5 bg-[#111] border border-white/6 rounded-lg text-xs text-neutral-300 hover:text-white hover:border-white/10 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportResults('pdf')}
                    disabled={isExporting}
                    className="px-2.5 py-1.5 bg-[#111] border border-white/6 rounded-lg text-xs text-neutral-300 hover:text-white hover:border-white/10 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </button>

                  <div className="h-5 w-px bg-white/6 shrink-0" />

                  <button
                    type="button"
                    onClick={clearSearch}
                    className="p-1.5 rounded-lg border border-white/4 hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>

                {/* Paraphrase Chips in Header */}
                {expandActive && expandedQueries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-white/2 pt-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                    <span className="font-mono text-[10px] uppercase font-bold text-neutral-400">Expanded Query Variants:</span>
                    {expandedQueries.map((eq, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono text-[10px]">
                        "{eq}"
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick Category Filter Chips */}
                <div className="flex flex-wrap gap-2 border-t border-white/2 pt-2">
                  {[
                    { label: 'All Chunks', value: '' },
                    { label: 'Invoices', value: 'INVOICE' },
                    { label: 'RFQs', value: 'RFQ' },
                    { label: 'Contracts', value: 'CONTRACT' },
                    { label: 'Compliance', value: 'COMPLIANCE' },
                    { label: 'Purchase Orders', value: 'PURCHASE_ORDER' }
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => {
                        setCategory(cat.value);
                        setTimeout(() => refetch(), 50);
                      }}
                      className={clsx(
                        "px-3 py-1 rounded-lg text-xs transition-all duration-200 border cursor-pointer",
                        category === cat.value
                          ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                          : "bg-[#111]/80 border-white/4 text-neutral-400 hover:text-neutral-200"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main double column layout */}
              <div className="flex-1 flex gap-6 overflow-hidden">
                
                {/* Left Side: Filter Sidebar Panel */}
                <div className="w-56 border border-white/4 bg-[#0c0c0c]/80 rounded-2xl p-4 flex flex-col gap-6 shrink-0 select-none">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/4">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Filter Results</span>
                  </div>

                  {/* Category Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Category Type</label>
                    <select
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setTimeout(() => refetch(), 50); }}
                      className="w-full bg-[#111] border border-white/6 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none"
                    >
                      <option value="">All Categories</option>
                      <option value="INVOICE">Invoices</option>
                      <option value="RFQ">RFQs</option>
                      <option value="CONTRACT">Contracts</option>
                      <option value="COMPLIANCE">Compliance</option>
                      <option value="PURCHASE_ORDER">Purchase Orders</option>
                    </select>
                  </div>

                  {/* Relevance Score Slider */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">
                      <span>Relevance Threshold</span>
                      <span className="text-primary font-mono font-semibold">{minScore}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      className="w-full accent-primary h-1 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Right Side: Search Results list */}
                <div className="flex-1 overflow-y-auto pr-2 scrollbar flex flex-col gap-4">
                  {isLoading ? (
                    <div className="py-20 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-5 w-5 opacity-30" />
                      <span>No matching document chunks found above score threshold.</span>
                    </div>
                  ) : (
                    filteredResults.map((item, index) => {
                      const isSelected = selectedDocIds.includes(item.id);
                      const itemScore = item.score !== undefined && item.score !== null 
                        ? item.score * 100 
                        : (item.consensus_score !== null ? item.consensus_score * 100 : 100);

                      // Calculate mock search statistics
                      const cosineScore = (itemScore / 100).toFixed(2);
                      const ftsScore = (itemScore / 100).toFixed(2);

                      return (
                        <div 
                          key={`${item.id}-${index}`}
                          className={clsx(
                            "group glass-card p-5 border bg-[#0c0c0c]/85 hover:bg-[#0c0c0c] transition-all duration-300 flex gap-4 items-start relative overflow-hidden",
                            isSelected ? "border-primary/45" : "border-white/4 hover:border-white/8"
                          )}
                        >
                          {/* Select check button for RAG */}
                          <button
                            onClick={() => handleToggleDocSelect(item.id)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer mt-0.5 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4.5 text-primary" />
                            ) : (
                              <Square className="h-4 w-4.5 opacity-60" />
                            )}
                          </button>

                          <div className="grow flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                {item.type === 'web' ? (
                                  <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-xs font-bold text-neutral-200 truncate max-w-[160px]">{item.filename}</span>
                                <Badge variant="category" value={item.category} size="sm">
                                  {item.category}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {searchMode === 'semantic' && (
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Cosine: {cosineScore}
                                  </span>
                                )}
                                {searchMode === 'keyword' && (
                                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    FTS: {ftsScore}
                                  </span>
                                )}
                                {searchMode === 'hybrid' && (
                                  <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    Hybrid: {cosineScore}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono font-bold text-[#4f8ef7]">
                                  Relevance: {Math.round(itemScore)}%
                                </span>
                                {item.type !== 'web' && (
                                  <button
                                    onClick={() => router.push(`/review?doc_id=${item.id}`)}
                                    className="px-2 py-0.5 text-[9px] font-bold border border-white/6 bg-white/2 hover:bg-white/8 hover:text-white rounded text-neutral-450 cursor-pointer transition-all"
                                  >
                                    Review
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Excerpt text display with highlights */}
                            {(item.snippet || item.excerpt) && (
                              <div 
                                className="mt-1 bg-black/35 border border-white/2 p-3 rounded-lg text-xs font-mono text-neutral-400 select-text leading-relaxed whitespace-pre-wrap [&>mark]:bg-primary/20 [&>mark]:text-primary [&>mark]:px-1 [&>mark]:rounded"
                                dangerouslySetInnerHTML={{ __html: item.snippet || item.excerpt || '' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Right Area: RAG Chat Panel (slides in if document(s) selected) */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-l border-white/4 bg-[#0c0c0c]/90 flex flex-col shrink-0 overflow-hidden h-full z-10"
          >
            {/* Chat header */}
            <div className="p-4 border-b border-white/4 bg-white/1 flex items-center justify-between select-none">
              <div className="flex items-center gap-2.5 text-primary">
                <MessageSquare className="h-4.5 w-4.5" />
                <span className="text-xs font-bold tracking-wider uppercase font-sans">RAG Copilot Chat</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExportChatToPDF}
                  className="px-2 py-0.5 text-[9px] font-bold border border-white/8 bg-white/2 hover:bg-white/8 rounded text-neutral-350 hover:text-white transition-all cursor-pointer"
                >
                  Export PDF
                </button>
                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-white/3 px-2 py-0.5 rounded-full border border-white/4">
                  Context: {selectedDocIds.length} docs
                </span>
              </div>
            </div>

            {/* Chat Messages flow */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar flex flex-col gap-4 bg-[#080808]/20">
              {chatHistory.length === 0 ? (
                <div className="grow flex flex-col items-center justify-center text-center gap-2 text-muted-foreground font-sans text-xs py-12 select-none">
                  <Sparkles className="h-5 w-5 text-primary/60 animate-pulse" />
                  <span>Ask a question about the selected document context...</span>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div 
                    key={idx}
                    className={clsx(
                      "flex flex-col gap-2 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed font-sans",
                      msg.role === 'user'
                        ? "bg-primary border border-primary/20 text-white self-end rounded-tr-none"
                        : "bg-[#111] border border-white/4 text-neutral-300 self-start rounded-tl-none select-text"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 border-t border-white/4 pt-1.5 flex flex-col gap-1 select-none">
                        <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Cited Sources:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {msg.citations.map((cite, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => router.push(`/review?doc_id=${cite.id}`)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/3 border border-white/6 hover:bg-white/8 text-[9px] text-neutral-400 hover:text-white transition-all cursor-pointer font-sans"
                            >
                              <FileText className="h-2.5 w-2.5 text-primary shrink-0" />
                              <span className="truncate max-w-[100px]">{cite.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* RAG Thinking loader */}
              {isChatLoading && (
                <div className="bg-[#111] border border-white/4 text-neutral-400 self-start rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs flex items-center gap-2 font-sans select-none animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  <span>AI agent analyzing document context...</span>
                </div>
              )}
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendChatMessage} className="p-4 border-t border-white/4 bg-white/1 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about prices, dates, terms..."
                disabled={isChatLoading}
                className="flex-1 bg-[#111] border border-white/6 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 font-sans"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="p-2.5 rounded-xl bg-primary border border-primary/20 text-white hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-primary/10 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Bookmarks Modal Drawer */}
      <AnimatePresence>
        {isBookmarksOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c0c0c] border border-white/8 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/6 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm font-sans">
                  <BookmarkCheck className="h-4.5 w-4.5" /> Saved Searches & Bookmarks
                </div>
                <button
                  onClick={() => setIsBookmarksOpen(false)}
                  className="p-1 text-muted-foreground hover:text-white rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No saved search bookmarks yet.
                  </div>
                ) : (
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-3 bg-[#111] border border-white/4 hover:border-primary/40 rounded-xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex flex-col gap-1 cursor-pointer flex-1" onClick={() => handleApplyBookmark(bm)}>
                        <span className="text-xs font-bold text-foreground font-sans truncate">{bm.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate">"{bm.query_text}"</span>
                      </div>
                      <button
                        onClick={() => handleDeleteBookmark(bm.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 cursor-pointer rounded hover:bg-white/5 transition-colors"
                        title="Delete Bookmark"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Bookmark Dialog */}
      <AnimatePresence>
        {isSaveBookmarkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c0c0c] border border-white/8 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/6 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm font-sans">
                  <Bookmark className="h-4.5 w-4.5" /> Save Search Bookmark
                </div>
                <button
                  onClick={() => setIsSaveBookmarkModalOpen(false)}
                  className="p-1 text-muted-foreground hover:text-white rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-300">Bookmark Name</label>
                <input
                  type="text"
                  value={bookmarkName}
                  onChange={(e) => setBookmarkName(e.target.value)}
                  placeholder={`Search: "${query}"`}
                  className="w-full bg-[#111] border border-white/6 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsSaveBookmarkModalOpen(false)}
                  className="px-3 py-1.5 bg-[#111] border border-white/6 rounded-lg text-xs text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBookmark}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
