'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AuditLogResponse, UserResponse, WebhookResponse, WebhookCreateRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';
import {
  User, Settings, Bell, Key, FileSpreadsheet,
  Moon, Sun, Lock, QrCode, Copy, Plus, Trash,
  Loader2, AlertCircle, Shield, UserCog,
  Webhook, CheckCircle2, AlertTriangle, ExternalLink, Filter, RefreshCw, Check
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/ui';

type TabId = 'profile' | 'appearance' | 'notifications' | 'apikeys' | 'webhooks' | 'team' | 'auditlog' | 'synonyms';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { setSidebarOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Synonyms management state
  const [newSynKey, setNewSynKey] = useState('');
  const [newSynValue, setNewSynValue] = useState('');

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qr_code_image: string; message: string } | null>(null);

  // Password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [collapseSidebar, setCollapseSidebar] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Notifications
  const [notifs, setNotifs] = useState<Record<string, { email: boolean; inApp: boolean }>>({
    reviewReady: { email: true, inApp: true },
    lockExpired: { email: true, inApp: true },
    complianceFlag: { email: true, inApp: false },
    approvalRequest: { email: false, inApp: true },
  });

  // API Keys
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Webhooks
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEventType, setWebhookEventType] = useState<'document.processed' | 'document.failed' | 'review.required'>('document.processed');
  const [webhookFilter, setWebhookFilter] = useState<'ALL' | 'document.processed' | 'document.failed' | 'review.required'>('ALL');
  const [webhookDeleteConfirmId, setWebhookDeleteConfirmId] = useState<string | null>(null);

  // Team — new invite form
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: api.listApiKeys,
    enabled: activeTab === 'apikeys',
  });

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: api.listUsers,
    enabled: activeTab === 'team' && user?.role === 'ADMIN',
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['settingsAuditLogs'],
    queryFn: () => api.getAuditLogs(30),
    enabled: activeTab === 'auditlog',
  });

  const { data: synonymsDict = {}, isLoading: synonymsLoading } = useQuery<Record<string, string[]>>({
    queryKey: ['synonyms'],
    queryFn: api.getSynonyms,
    enabled: activeTab === 'synonyms',
  });

  const {
    data: webhooks = [],
    isLoading: webhooksLoading,
    isFetching: webhooksFetching,
    refetch: refetchWebhooks,
  } = useQuery<WebhookResponse[]>({
    queryKey: ['webhooks'],
    queryFn: api.listWebhooks,
    enabled: activeTab === 'webhooks',
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string; email?: string }) => api.updateProfile(data),
    onSuccess: (updated) => {
      setUser?.(updated);
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update profile'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.changePassword(current, next),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to change password'),
  });

  const generateKeyMutation = useMutation({
    mutationFn: (name: string) => api.generateApiKey(name),
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API Key generated — copy it now, it will not be shown again');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate API Key'),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API Key revoked');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to revoke key'),
  });

  const updateSynonymsMutation = useMutation({
    mutationFn: (data: Record<string, string[]>) => api.updateSynonyms(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synonyms'] });
      toast.success('Synonym dictionary updated successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update synonyms'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      toast.success('User role updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update role'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      toast.success('User removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove user'),
  });

  const registerWebhookMutation = useMutation({
    mutationFn: (data: WebhookCreateRequest) => api.registerWebhook(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Webhook registered successfully');
      setWebhookUrl('');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register webhook');
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => api.deleteWebhook(webhookId),
    onSuccess: () => {
      toast.success('Webhook subscription revoked');
      setWebhookDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revoke webhook');
    },
  });

  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(saved as 'dark' | 'light');
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
  }, [user]);

  useEffect(() => {
    const storedSidebar = localStorage.getItem('settings_sidebar_collapsed');
    if (storedSidebar !== null) {
      setCollapseSidebar(storedSidebar === 'true');
      setSidebarOpen(storedSidebar !== 'true');
    }
    const storedFont = localStorage.getItem('settings_font_size');
    if (storedFont === 'sm' || storedFont === 'md' || storedFont === 'lg') {
      setFontSize(storedFont);
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('settings_sidebar_collapsed', String(collapseSidebar));
    setSidebarOpen(!collapseSidebar);
  }, [collapseSidebar, setSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('settings_font_size', fontSize);
    const scale = fontSize === 'sm' ? '15px' : fontSize === 'lg' ? '17px' : '16px';
    document.documentElement.style.fontSize = scale;
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ full_name: fullName, email });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match'); return; }
    if (newPwd.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    changePasswordMutation.mutate({ current: currentPwd, next: newPwd });
  };

  const handleThemeChange = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    toast.success(`Theme set to ${t} mode`);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    generateKeyMutation.mutate(newKeyName.trim());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // ── SSRF Heuristic Validation for Webhooks (Requirement R3) ───────────────
  const checkSsrfSecurity = (urlStr: string) => {
    const trimmed = urlStr.trim();
    if (!trimmed) {
      return {
        status: 'empty' as const,
        badge: 'URL Required',
        message: 'Enter destination webhook endpoint URL (HTTPS recommended)',
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        status: 'warning' as const,
        badge: 'Invalid URL Format',
        message: 'Destination must be a well-formed absolute URL starting with https:// or http://',
      };
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        status: 'blocked' as const,
        badge: 'Prohibited Protocol',
        message: `Protocol "${protocol}" is blocked. Webhooks only support HTTP and HTTPS destinations.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? parseInt(parsed.port, 10) : (protocol === 'https:' ? 443 : 80);

    // Port check (matching backend security_net.py: 80, 443, 8000, 8080, 8443)
    const allowedPorts = [80, 443, 8000, 8080, 8443];
    if (!allowedPorts.includes(port)) {
      return {
        status: 'warning' as const,
        badge: 'Non-Standard Port',
        message: `Port ${port} is outside standard webhook delivery ports (80, 443, 8000, 8080, 8443). Backend SSRF policy will reject this.`,
      };
    }

    // Blocked hostnames & local domains
    const blockedHostnames = ['localhost', 'localhost.localdomain', 'metadata.google.internal', 'instance-data'];
    if (
      blockedHostnames.includes(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Local/Internal Hostname',
        message: `Host "${hostname}" is an internal/loopback hostname and violates zero-trust SSRF policy.`,
      };
    }

    // Loopback IPv4: 127.0.0.0/8 or IPv6 ::1
    if (
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      /^127\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Loopback IP',
        message: 'Loopback address (127.0.0.0/8 or ::1) is strictly prohibited to prevent internal service abuse.',
      };
    }

    // Unspecified 0.0.0.0
    if (hostname === '0.0.0.0' || /^0\.\d+\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: 0.0.0.0 Network',
        message: 'Address 0.0.0.0 is prohibited by SSRF security policy.',
      };
    }

    // Private IPv4 ranges (RFC 1918)
    // 10.0.0.0/8
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Private Network (10.0.0.0/8)',
        message: 'Class A private IP range is blocked. Webhooks must target public internet endpoints.',
      };
    }
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Private Network (172.16.0.0/12)',
        message: 'Class B private IP range (172.16.0.0/12) is blocked by SSRF security policy.',
      };
    }
    // 192.168.0.0/16
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Private Network (192.168.0.0/16)',
        message: 'Class C private IP range (192.168.x.x) is blocked. Webhook URLs must be publicly routable.',
      };
    }
    // Link-local / Cloud Metadata: 169.254.0.0/16
    if (/^169\.254\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: Cloud Metadata (169.254.0.0/16)',
        message: 'Link-local and cloud metadata addresses are prohibited to prevent credential exfiltration.',
      };
    }
    // Carrier-Grade NAT: 100.64.0.0/10
    if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+$/.test(hostname)) {
      return {
        status: 'blocked' as const,
        badge: 'SSRF Blocked: CGNAT Address (100.64.0.0/10)',
        message: 'Carrier-Grade NAT private ranges are blocked by SSRF security policy.',
      };
    }

    if (protocol === 'http:') {
      return {
        status: 'warning' as const,
        badge: 'Plain HTTP: Encryption Recommended',
        message: 'Endpoint is accessible via HTTP, but HTTPS is strongly recommended for production webhook security.',
      };
    }

    return {
      status: 'safe' as const,
      badge: 'Public HTTPS Endpoint Validated',
      message: 'Zero-trust SSRF heuristic passed. Destination is a valid public HTTPS endpoint.',
    };
  };

  const WEBHOOK_EVENT_TYPES = [
    {
      id: 'document.processed' as const,
      label: 'document.processed',
      desc: 'Dispatched when document extraction and validation complete successfully.',
      badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      dotClass: 'bg-emerald-400',
    },
    {
      id: 'document.failed' as const,
      label: 'document.failed',
      desc: 'Dispatched on unrecoverable extraction or processing failures.',
      badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      dotClass: 'bg-rose-400',
    },
    {
      id: 'review.required' as const,
      label: 'review.required',
      desc: 'Dispatched when confidence score triggers manual human review.',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      dotClass: 'bg-amber-400',
    },
  ];

  const handleRegisterWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      toast.error('Please enter a destination webhook URL');
      return;
    }
    const validation = checkSsrfSecurity(webhookUrl);
    if (validation.status === 'blocked') {
      toast.error(validation.message);
      return;
    }
    registerWebhookMutation.mutate({
      url: webhookUrl.trim(),
      event_type: webhookEventType,
    });
  };

  const filteredWebhooks = webhooks.filter((w) => {
    if (webhookFilter === 'ALL') return true;
    return w.event_type === webhookFilter;
  });

  const TABS: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'User Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'team', label: 'Team Settings', icon: UserCog, adminOnly: true },
    { id: 'auditlog', label: 'Audit Log', icon: FileSpreadsheet, adminOnly: true },
    { id: 'synonyms', label: 'Synonyms Dictionary', icon: Settings },
  ];

  const tabMotion = {
    initial: { opacity: 0, x: 6 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -6 },
    transition: { duration: 0.18 },
  };

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Configuration</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your profile, security credentials, API keys, and team access.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar nav */}
        <div className="w-full md:w-60 glass-card bg-black/40 border border-white/8 rounded-2xl p-2 flex flex-col gap-1 shrink-0 backdrop-blur-xl">
          {TABS.map(tab => {
            if (tab.adminOnly && user?.role !== 'ADMIN') return null;
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setGeneratedKey(null); }}
                className={clsx(
                  'touch-press w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200',
                  active
                    ? 'bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/5'
                    : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}>
                <Icon className="h-4 w-4 shrink-0" /><span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content card */}
        <div className="flex-1 w-full glass-card bg-black/40 border border-white/8 rounded-2xl min-h-[480px] p-6 md:p-8 backdrop-blur-xl">
          <AnimatePresence mode="wait">

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <motion.div key="profile" {...tabMotion} className="flex flex-col gap-7 w-full max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-foreground">User Profile</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Update your name, email address, and security credentials.</p>
                </div>

                {/* Avatar + profile form */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {/* Avatar uploader */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Avatar</span>
                    <div
                      className="relative w-24 h-24 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden group cursor-pointer hover:border-primary/50 transition-all shadow-inner"
                      onClick={() => {
                        const inp = document.createElement('input');
                        inp.type = 'file'; inp.accept = 'image/*';
                        inp.onchange = (e: Event) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) { const r = new FileReader(); r.onload = () => setAvatarImage(r.result as string); r.readAsDataURL(f); }
                        };
                        inp.click();
                      }}>
                      {avatarImage
                        ? <img src={avatarImage} className="w-full h-full object-cover" alt="avatar" />
                        : <div className="flex flex-col items-center gap-1 text-muted-foreground p-3 text-center">
                            <User className="h-6 w-6 group-hover:text-primary transition-colors" />
                            <span className="text-[8px]">Click to upload</span>
                          </div>}
                    </div>
                    {avatarImage && (
                      <button onClick={() => setAvatarImage(null)}
                        className="touch-press px-2 py-0.5 text-[9px] font-bold rounded-lg border border-rose-500/20 text-rose-400 bg-rose-500/5 cursor-pointer">
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleUpdateProfile} className="flex-1 flex flex-col gap-4 w-full">
                    {[
                      { label: 'Full Name', value: fullName, set: setFullName, type: 'text' },
                      { label: 'Email Address', value: email, set: setEmail, type: 'email' },
                    ].map(f => (
                      <div key={f.label} className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">{f.label}</label>
                        <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">System Role</label>
                      <div className="w-full bg-white/5 border border-white/10 text-muted-foreground rounded-xl px-4 py-2.5 text-xs font-semibold select-none">
                        {user?.role || 'OPERATOR'}
                      </div>
                    </div>
                    <button type="submit" disabled={updateProfileMutation.isPending}
                      className="touch-press self-start px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/15">
                      {updateProfileMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Profile
                    </button>
                  </form>
                </div>

                <div className="h-px bg-white/4" />

                {/* Change Password */}
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5"><Lock className="h-4 w-4 text-primary" /> Change Password</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Requires your current password. New password must score ≥ 3 on zxcvbn.</p>
                  </div>
                  <form onSubmit={handleChangePassword} className="flex flex-col gap-3 max-w-sm">
                    {[
                      { label: 'Current Password', value: currentPwd, set: setCurrentPwd },
                      { label: 'New Password', value: newPwd, set: setNewPwd },
                      { label: 'Confirm New Password', value: confirmPwd, set: setConfirmPwd },
                    ].map(f => (
                      <div key={f.label} className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">{f.label}</label>
                        <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    ))}
                    <button type="submit" disabled={changePasswordMutation.isPending}
                      className="touch-press self-start px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2">
                      {changePasswordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Update Password
                    </button>
                  </form>
                </div>

                <div className="h-px bg-white/4" />

                {/* 2FA — real TOTP implementation (Roadmap 1.2) */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-400" /> Two-Factor Authentication</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Add a TOTP authenticator app for enhanced login security.</p>
                    </div>
                    <button onClick={async () => {
                      if (!show2FA) {
                        try {
                          const data = await api.setup2FA();
                          setQrCodeData(data);
                          setShow2FA(true);
                        } catch (e: unknown) {
                          toast.error((e as Error).message || 'Failed to setup 2FA');
                        }
                      } else {
                        setShow2FA(false);
                        setQrCodeData(null);
                        setTwoFACode('');
                      }
                    }}
                      className={clsx('touch-press px-4 py-1.5 border rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer',
                        show2FA ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')}>
                      {show2FA ? 'Cancel' : 'Enable 2FA'}
                    </button>
                  </div>
                  {show2FA && qrCodeData && (
                    <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      onSubmit={async e => {
                        e.preventDefault();
                        try {
                          await api.verify2FA(twoFACode);
                          toast.success('2FA enabled successfully!');
                          setShow2FA(false);
                          setQrCodeData(null);
                          setTwoFACode('');
                        } catch (err: unknown) {
                          toast.error((err as Error).message || 'Invalid TOTP code');
                        }
                      }}
                      className="p-4 rounded-xl border border-white/8 bg-white/5 flex flex-col sm:flex-row items-center gap-5">
                      <div className="p-2 bg-white rounded-lg shrink-0 shadow-lg shadow-black/20">
                        {/* Real QR code from backend */}
                        {qrCodeData.qr_code_image ? (
                          <img src={qrCodeData.qr_code_image} alt="2FA QR Code" className="w-24 h-24" />
                        ) : (
                          <QrCode className="h-20 w-20 text-black" />
                        )}
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Scan with Google Authenticator or Authy, then enter the 6-digit code to activate.
                        </p>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-muted-foreground font-mono">Manual key: <span className="text-neutral-300 select-all">{qrCodeData.secret}</span></span>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" maxLength={6} placeholder="000000" value={twoFACode} onChange={e => setTwoFACode(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-center tracking-widest w-28 focus:outline-none" />
                          <button type="submit" className="touch-press px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-500/10">Verify & Enable</button>
                        </div>
                      </div>
                    </motion.form>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── APPEARANCE ── */}
            {activeTab === 'appearance' && (
              <motion.div key="appearance" {...tabMotion} className="flex flex-col gap-6 w-full max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Appearance</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Customize theme, layout defaults, and typography scale.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Theme Mode</span>
                  <div className="flex gap-3">
                    {(['dark', 'light'] as const).map(t => (
                      <button key={t} onClick={() => handleThemeChange(t)}
                        className={clsx('touch-press flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-xs transition-all cursor-pointer',
                          theme === t ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-neutral-900 border-neutral-800 text-muted-foreground hover:text-foreground')}>
                        {t === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-white/8 bg-white/5 rounded-xl gap-4 select-none">
                  <div>
                    <span className="text-xs font-bold text-foreground">Collapsed Sidebar Default</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Start with the sidebar collapsed on every page load.</p>
                  </div>
                  <button type="button" onClick={() => { setCollapseSidebar(v => !v); toast.success('Sidebar preference saved'); }}
                    className={clsx('touch-press relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', collapseSidebar ? 'bg-primary' : 'bg-white/10')}>
                    <span className={clsx('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition', collapseSidebar ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Typography Scale</span>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map(s => (
                      <button key={s} onClick={() => { setFontSize(s); toast.success(`Font scale set to ${s}`); }}
                        className={clsx('touch-press px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer uppercase transition-all',
                          fontSize === s ? 'bg-white/10 border-white/15 text-foreground' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <motion.div key="notifications" {...tabMotion} className="flex flex-col gap-6 w-full max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Notification Preferences</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Configure when you receive email and in-app alerts.</p>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { key: 'reviewReady', label: 'Document Ready for Review', desc: 'Alert when extraction finishes with pending verification flags' },
                    { key: 'lockExpired', label: 'Review Lock Expired', desc: 'Trigger when your editor lock expires back to the pool' },
                    { key: 'complianceFlag', label: 'Compliance Issue Flagged', desc: 'Alert when compliance score drops below tolerance threshold' },
                    { key: 'approvalRequest', label: 'Approval Request', desc: 'Notify when manager approval is requested on a document' },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between p-4 border border-white/8 bg-white/5 rounded-xl gap-4">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-xs font-bold text-foreground">{n.label}</span>
                        <p className="text-[10px] text-muted-foreground">{n.desc}</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0 text-[10px] font-mono text-neutral-400">
                        {(['email', 'inApp'] as const).map(ch => (
                          <label key={ch} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={notifs[n.key]?.[ch] || false}
                              onChange={e => { setNotifs(p => ({ ...p, [n.key]: { ...p[n.key], [ch]: e.target.checked } })); toast.success('Saved'); }}
                              className="h-4 w-4 rounded text-primary cursor-pointer" />
                            <span>{ch === 'email' ? 'Email' : 'In-App'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── API KEYS ── */}
            {activeTab === 'apikeys' && (
              <motion.div key="apikeys" {...tabMotion} className="flex flex-col gap-6 w-full">
                <div>
                  <h3 className="text-sm font-bold text-foreground">API Keys</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Generate tokens for third-party integrations using the X-API-Key header.</p>
                </div>

                <div className="border border-white/8 bg-black/30 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        <th className="py-2.5 px-4">Name</th>
                        <th className="py-2.5 px-4">Prefix</th>
                        <th className="py-2.5 px-4">Created</th>
                        <th className="py-2.5 px-4">Expires</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/2 text-neutral-300">
                      {keysLoading ? (
                        <tr><td colSpan={5} className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
                      ) : apiKeys.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">No API keys yet.</td></tr>
                      ) : apiKeys.map(k => (
                        <tr key={k.id} className="hover:bg-white/1">
                          <td className="py-3 px-4 font-semibold">{k.name}</td>
                          <td className="py-3 px-4 font-mono text-[10px] text-neutral-400">{k.prefix}</td>
                          <td className="py-3 px-4 text-[10px] text-muted-foreground font-mono">{new Date(k.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-[10px] text-muted-foreground font-mono">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '—'}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => revokeKeyMutation.mutate(k.id)} title="Revoke"
                              className="touch-press p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 cursor-pointer">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {generatedKey && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 flex flex-col gap-2">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase">New Key — copy now, shown only once</span>
                    <div className="flex gap-2 items-center bg-black/40 border border-white/4 rounded-lg p-2 px-3">
                      <span className="text-[10px] font-mono text-neutral-300 break-all flex-1">{generatedKey}</span>
                      <button onClick={() => copyToClipboard(generatedKey)}
                        className="touch-press p-1.5 rounded border border-white/6 hover:bg-white/6 cursor-pointer text-neutral-300 hover:text-white shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleGenerateKey} className="flex gap-3 items-end max-w-sm">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Key Label</label>
                    <input type="text" placeholder="e.g. ERP Integration" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50" />
                  </div>
                  <button type="submit" disabled={generateKeyMutation.isPending}
                    className="touch-press px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer h-9 disabled:opacity-50 shadow-lg shadow-primary/15">
                    {generateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Generate
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── WEBHOOKS (Requirement R3) ── */}
            {activeTab === 'webhooks' && (
              <motion.div key="webhooks" {...tabMotion} className="flex flex-col gap-7 w-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        <Webhook className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Enterprise Webhooks Console</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Configure real-time event dispatching with HMAC-SHA256 signatures and strict zero-trust SSRF protection.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchWebhooks()}
                    disabled={webhooksFetching}
                    className="touch-press px-3 py-1.5 rounded-xl border border-white/8 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={clsx('h-3.5 w-3.5', webhooksFetching && 'animate-spin text-primary')} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Non-Admin Warning Banner (if current user is not admin) */}
                {user && user.role !== 'ADMIN' && (
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="font-bold text-amber-300">Admin Privileges Required</span>
                      <p className="text-[11px] text-amber-200/80">
                        Managing webhook subscriptions requires an administrator account. You are currently logged in as a {user.role}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Register New Webhook Card */}
                <div className="glass-card bg-black/40 border border-white/8 rounded-2xl p-5 md:p-6 backdrop-blur-xl flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground tracking-wide uppercase font-mono">
                        Register Webhook Endpoint
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      HMAC-SHA256 Signed
                    </span>
                  </div>

                  <form onSubmit={handleRegisterWebhook} className="flex flex-col gap-5">
                    {/* URL Input & SSRF Feedback */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                          Destination Endpoint URL
                        </label>
                        <span className="text-[9px] text-neutral-400 font-mono">
                          Allowed: Ports 80, 443, 8000, 8080, 8443
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="url"
                          placeholder="https://api.yourcompany.com/webhooks/docintel"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          className={clsx(
                            'w-full bg-neutral-900 border rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono transition-colors focus:outline-none',
                            (() => {
                              const v = checkSsrfSecurity(webhookUrl);
                              if (v.status === 'blocked') return 'border-rose-500/50 focus:border-rose-500';
                              if (v.status === 'safe') return 'border-emerald-500/50 focus:border-emerald-500';
                              if (v.status === 'warning') return 'border-amber-500/50 focus:border-amber-500';
                              return 'border-white/10 focus:border-primary/50';
                            })()
                          )}
                        />
                      </div>

                      {/* URL SSRF Security Feedback Box */}
                      {(() => {
                        const validation = checkSsrfSecurity(webhookUrl);
                        if (validation.status === 'safe') {
                          return (
                            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 flex items-start gap-2.5 animate-fadeIn">
                              <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-emerald-300">
                                    {validation.badge}
                                  </span>
                                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                                    VERIFIED
                                  </span>
                                </div>
                                <p className="text-[10px] text-emerald-200/80">{validation.message}</p>
                              </div>
                            </div>
                          );
                        }
                        if (validation.status === 'warning') {
                          return (
                            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/8 flex items-start gap-2.5 animate-fadeIn">
                              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="text-[11px] font-bold text-amber-300">{validation.badge}</span>
                                <p className="text-[10px] text-amber-200/80">{validation.message}</p>
                              </div>
                            </div>
                          );
                        }
                        if (validation.status === 'blocked') {
                          return (
                            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5 animate-fadeIn">
                              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-rose-300">{validation.badge}</span>
                                  <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-mono font-bold">
                                    BLOCKED
                                  </span>
                                </div>
                                <p className="text-[10px] text-rose-200/90 leading-relaxed">{validation.message}</p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="p-2.5 rounded-xl border border-white/5 bg-white/2 flex items-center gap-2 text-muted-foreground text-[10px]">
                            <Shield className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                            <span>
                              🛡️ Zero-Trust SSRF Protection: Loopback (127.0.0.1), private RFC 1918 subnets (10.x, 192.168.x, 172.16-31.x), and cloud metadata (169.254.x) are strictly prohibited.
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Event Type Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Event Type Subscription
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {WEBHOOK_EVENT_TYPES.map((evt) => {
                          const isSelected = webhookEventType === evt.id;
                          return (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={() => setWebhookEventType(evt.id)}
                              className={clsx(
                                'touch-press text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 relative',
                                isSelected
                                  ? 'border-primary/40 bg-primary/10 shadow-sm shadow-primary/10'
                                  : 'border-white/6 bg-white/2 hover:bg-white/4 hover:border-white/10'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={clsx('text-[11px] font-mono font-bold', evt.badgeClass.split(' ')[0])}>
                                  {evt.label}
                                </span>
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <span className={clsx('h-2 w-2 rounded-full', evt.dotClass)} />
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-snug">{evt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={
                          registerWebhookMutation.isPending ||
                          !webhookUrl.trim() ||
                          checkSsrfSecurity(webhookUrl).status === 'blocked'
                        }
                        className="touch-press px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {registerWebhookMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        <span>Register Webhook</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Active Webhooks List Section */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Active Subscriptions
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-neutral-300">
                        {webhooks.length} {webhooks.length === 1 ? 'subscription' : 'subscriptions'}
                      </span>
                    </div>

                    {/* Event Type Filter Selector */}
                    <div className="flex items-center gap-1.5 bg-[#090909] border border-white/6 p-1 rounded-xl">
                      <Filter className="h-3 w-3 text-muted-foreground ml-1.5 shrink-0" />
                      {(['ALL', 'document.processed', 'document.failed', 'review.required'] as const).map((filterOpt) => (
                        <button
                          key={filterOpt}
                          type="button"
                          onClick={() => setWebhookFilter(filterOpt)}
                          className={clsx(
                            'touch-press px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all duration-150 cursor-pointer',
                            webhookFilter === filterOpt
                              ? 'bg-primary/20 text-primary border border-primary/30 font-bold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
                          )}
                        >
                          {filterOpt === 'ALL' ? 'All' : filterOpt.replace('document.', '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Webhook Table */}
                  <div className="border border-white/8 bg-[#090909] rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono bg-white/1">
                            <th className="py-3 px-4">Webhook ID & URL</th>
                            <th className="py-3 px-4">Event Trigger</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Created</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/4 text-neutral-300">
                          {webhooksLoading ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                <span className="text-[11px] text-muted-foreground mt-2 block font-mono">
                                  Loading webhook configurations...
                                </span>
                              </td>
                            </tr>
                          ) : filteredWebhooks.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <div className="p-3 rounded-2xl bg-white/3 border border-white/6 text-neutral-400">
                                    <Webhook className="h-6 w-6" />
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-300">
                                    {webhooks.length === 0
                                      ? 'No webhooks registered'
                                      : 'No webhooks match the selected filter'}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground max-w-sm">
                                    {webhooks.length === 0
                                      ? 'Register an HTTPS destination above to start receiving automated callbacks on document processing events.'
                                      : 'Try selecting a different filter option or clear the filter.'}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredWebhooks.map((w) => {
                              const isConfirmingDelete = webhookDeleteConfirmId === w.id;
                              const matchingMeta = WEBHOOK_EVENT_TYPES.find((e) => e.id === w.event_type);
                              const formattedDate = w.created_at
                                ? new Date(w.created_at).toLocaleString()
                                : '—';

                              return (
                                <tr key={w.id} className="hover:bg-white/2 transition-colors">
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-foreground break-all">
                                          {w.url}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                                        <span>ID: {w.id.slice(0, 8)}...</span>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(w.id)}
                                          title="Copy full Webhook ID"
                                          className="touch-press text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                                        >
                                          <Copy className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span
                                      className={clsx(
                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border',
                                        matchingMeta?.badgeClass ?? 'text-neutral-300 bg-white/5 border-white/10'
                                      )}
                                    >
                                      <span
                                        className={clsx(
                                          'h-1.5 w-1.5 rounded-full',
                                          matchingMeta?.dotClass ?? 'bg-neutral-400'
                                        )}
                                      />
                                      {w.event_type}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      {w.is_active ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-[10px] text-muted-foreground font-mono">
                                    {formattedDate}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    {isConfirmingDelete ? (
                                      <div className="flex items-center justify-end gap-1.5 animate-fadeIn">
                                        <button
                                          type="button"
                                          onClick={() => setWebhookDeleteConfirmId(null)}
                                          className="touch-press px-2 py-1 rounded-lg text-[10px] bg-white/5 hover:bg-white/10 text-neutral-300 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={deleteWebhookMutation.isPending}
                                          onClick={() => deleteWebhookMutation.mutate(w.id)}
                                          className="touch-press px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                          {deleteWebhookMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            'Revoke'
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setWebhookDeleteConfirmId(w.id)}
                                        title="Revoke subscription"
                                        className="touch-press p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 cursor-pointer transition-colors"
                                      >
                                        <Trash className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TEAM MANAGEMENT ── */}
            {activeTab === 'team' && (
              <motion.div key="team" {...tabMotion} className="flex flex-col gap-6 w-full">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Team Management</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">View all registered users, change roles, and remove accounts.</p>
                </div>

                <div className="border border-white/4 bg-[#090909] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        <th className="py-2.5 px-4">Member</th>
                        <th className="py-2.5 px-4">Email</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/2 text-neutral-300">
                      {teamLoading ? (
                        <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
                      ) : (teamMembers as UserResponse[]).map(member => (
                        <tr key={member.id} className="hover:bg-white/1 transition-colors">
                          <td className="py-3 px-4 font-semibold">{member.full_name}</td>
                          <td className="py-3 px-4 text-[10px] text-muted-foreground font-mono">{member.email}</td>
                          <td className="py-3 px-4">
                            <select value={member.role}
                              onChange={e => updateRoleMutation.mutate({ userId: member.id, role: e.target.value })}
                              disabled={member.id === user?.id}
                              className={clsx('bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer focus:outline-none transition-colors',
                                member.role === 'ADMIN' ? 'text-primary' : member.role === 'REVIEWER' ? 'text-emerald-400' : 'text-amber-400')}>
                              <option value="ADMIN">ADMIN</option>
                              <option value="REVIEWER">REVIEWER</option>
                              <option value="OPERATOR">OPERATOR</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => deleteUserMutation.mutate(member.id)}
                              disabled={member.id === user?.id}
                              title="Remove user"
                              className="touch-press p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invite via registration */}
                <div className="p-4 border border-white/4 bg-[#090909]/60 rounded-xl flex flex-col gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-bold text-neutral-300">To invite a new member:</span> share the registration link and they can sign up. The first user is auto-promoted to ADMIN. You can then update their role using the dropdown above.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── AUDIT LOG ── */}
            {activeTab === 'auditlog' && (
              <motion.div key="auditlog" {...tabMotion} className="flex flex-col gap-6 w-full">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Administrative Audit Trail</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Immutable log of all document actions, corrections, and lock events.</p>
                </div>
                <div className="border border-white/4 bg-[#090909] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto scrollbar">
                  {logsLoading ? (
                    <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
                  ) : !auditLogs || auditLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                      <AlertCircle className="h-5 w-5 opacity-30" /><span>No audit logs recorded yet.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-white/4 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-[#090909]">
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Operator</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Document</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/2">
                        {(auditLogs as AuditLogResponse[]).map(log => (
                          <tr key={log.id} className="hover:bg-white/1">
                            <td className="py-2 px-4 text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-4 text-[10px] font-semibold text-neutral-400">{log.operator}</td>
                            <td className="py-2 px-4 text-[10px] font-bold text-primary">{log.action}</td>
                            <td className="py-2 px-4 text-[10px] text-neutral-400 max-w-[180px] truncate">{log.filename || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── SYNONYMS DICTIONARY ── */}
            {activeTab === 'synonyms' && (
              <motion.div key="synonyms" {...tabMotion} className="flex flex-col gap-6 w-full max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Local Search Synonym Expansion</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Define local word mappings to automatically expand query matching for completely offline search.</p>
                </div>
                
                {/* Form to add a new synonym group */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSynKey.trim() || !newSynValue.trim()) return;
                  const terms = newSynValue.split(',').map(s => s.trim()).filter(Boolean);
                  const updated = { ...synonymsDict, [newSynKey.trim().toLowerCase()]: terms };
                  updateSynonymsMutation.mutate(updated);
                  setNewSynKey('');
                  setNewSynValue('');
                }} className="flex flex-col gap-3 p-4 border border-white/4 bg-white/1 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add Synonym Mapping</span>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" placeholder="Base Word (e.g. invoice)"
                      value={newSynKey} onChange={(e) => setNewSynKey(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40 font-mono" />
                    <input type="text" placeholder="Synonyms (comma separated)"
                      value={newSynValue} onChange={(e) => setNewSynValue(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40 font-mono" />
                    <button type="submit" disabled={updateSynonymsMutation.isPending}
                      className="touch-press bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer self-end sm:self-auto">
                      {updateSynonymsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                    </button>
                  </div>
                </form>

                {/* List of current synonym mappings */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Dictionary</span>
                  {synonymsLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 text-primary animate-spin" /></div>
                  ) : Object.keys(synonymsDict).length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No synonym mappings configured.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {Object.entries(synonymsDict).map(([key, values]) => (
                        <div key={key} className="flex justify-between items-center bg-[#090909] border border-white/4 rounded-xl px-4 py-2.5 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-bold">{key}</span>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex flex-wrap gap-1">
                              {values.map(v => (
                                <span key={v} className="bg-white/5 border border-white/5 text-[10px] px-1.5 py-0.5 rounded text-neutral-300">{v}</span>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={() => {
                            const updated = { ...synonymsDict };
                            delete updated[key];
                            updateSynonymsMutation.mutate(updated);
                          }} className="touch-press text-muted-foreground hover:text-red-400 p-1 transition-colors cursor-pointer">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
