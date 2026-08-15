'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AuditLogResponse, UserResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';
import {
  User, Settings, Bell, Key, FileSpreadsheet,
  Moon, Sun, Lock, QrCode, Copy, Plus, Trash,
  Loader2, AlertCircle, Shield, UserCog
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import zxcvbn from 'zxcvbn';

type TabId = 'profile' | 'appearance' | 'notifications' | 'apikeys' | 'team' | 'auditlog' | 'synonyms';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
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

  // Team — new invite form
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'ADMIN' | 'REVIEWER' | 'OPERATOR'>('OPERATOR');

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

  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(saved as 'dark' | 'light');
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
  }, [user]);

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

  const TABS: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'User Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'apikeys', label: 'API Keys', icon: Key },
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
        <div className="w-full md:w-60 border border-white/4 bg-[#0c0c0c]/80 rounded-2xl p-2 flex flex-col gap-1 shrink-0">
          {TABS.map(tab => {
            if (tab.adminOnly && user?.role !== 'ADMIN') return null;
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setGeneratedKey(null); }}
                className={clsx(
                  'w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200',
                  active
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/2'
                )}>
                <Icon className="h-4 w-4 shrink-0" /><span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content card */}
        <div className="flex-1 w-full border border-white/4 bg-[#0c0c0c]/80 rounded-2xl min-h-[480px] p-6 md:p-8">
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
                      className="relative w-24 h-24 rounded-full border border-white/8 bg-neutral-900/60 flex items-center justify-center overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
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
                        className="px-2 py-0.5 text-[9px] font-bold rounded-lg border border-rose-500/20 text-rose-400 bg-rose-500/5 cursor-pointer">
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
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">System Role</label>
                      <div className="w-full bg-neutral-950 border border-neutral-900 text-muted-foreground rounded-xl px-4 py-2.5 text-xs font-semibold select-none">
                        {user?.role || 'OPERATOR'}
                      </div>
                    </div>
                    <button type="submit" disabled={updateProfileMutation.isPending}
                      className="self-start px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
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
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                      </div>
                    ))}
                    <button type="submit" disabled={changePasswordMutation.isPending}
                      className="self-start px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2">
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
                      className={clsx('px-4 py-1.5 border rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer',
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
                      className="p-4 rounded-xl border border-white/4 bg-neutral-950 flex flex-col sm:flex-row items-center gap-5">
                      <div className="p-2 bg-white rounded-lg shrink-0">
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
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-center tracking-widest w-28 focus:outline-none" />
                          <button type="submit" className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer">Verify & Enable</button>
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
                        className={clsx('flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-xs transition-all cursor-pointer',
                          theme === t ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-neutral-900 border-neutral-800 text-muted-foreground hover:text-foreground')}>
                        {t === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-white/4 bg-[#0c0c0c] rounded-xl gap-4 select-none">
                  <div>
                    <span className="text-xs font-bold text-foreground">Collapsed Sidebar Default</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Start with the sidebar collapsed on every page load.</p>
                  </div>
                  <button type="button" onClick={() => { setCollapseSidebar(v => !v); toast.success('Sidebar preference saved'); }}
                    className={clsx('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', collapseSidebar ? 'bg-primary' : 'bg-neutral-800')}>
                    <span className={clsx('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition', collapseSidebar ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Typography Scale</span>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map(s => (
                      <button key={s} onClick={() => { setFontSize(s); toast.success(`Font scale set to ${s}`); }}
                        className={clsx('px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer uppercase transition-all',
                          fontSize === s ? 'bg-neutral-800 border-neutral-700 text-foreground' : 'bg-neutral-900 border-neutral-800 text-muted-foreground hover:text-foreground')}>
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
                    <div key={n.key} className="flex items-center justify-between p-4 border border-white/4 bg-[#0c0c0c] rounded-xl gap-4">
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

                <div className="border border-white/4 bg-[#090909] rounded-xl overflow-hidden">
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
                              className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 cursor-pointer">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {generatedKey && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-2">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase">New Key — copy now, shown only once</span>
                    <div className="flex gap-2 items-center bg-black/40 border border-white/4 rounded-lg p-2 px-3">
                      <span className="text-[10px] font-mono text-neutral-300 break-all flex-1">{generatedKey}</span>
                      <button onClick={() => copyToClipboard(generatedKey)}
                        className="p-1.5 rounded border border-white/6 hover:bg-white/6 cursor-pointer text-neutral-300 hover:text-white shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleGenerateKey} className="flex gap-3 items-end max-w-sm">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Key Label</label>
                    <input type="text" placeholder="e.g. ERP Integration" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50" />
                  </div>
                  <button type="submit" disabled={generateKeyMutation.isPending}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer h-9 disabled:opacity-50">
                    {generateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Generate
                  </button>
                </form>
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
                              className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer self-end sm:self-auto">
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
                          }} className="text-muted-foreground hover:text-red-400 p-1 transition-colors cursor-pointer">
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
