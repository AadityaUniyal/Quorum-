'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'react-hot-toast';
import { Users, ScrollText, Trash2, Loader2, Shield } from 'lucide-react';
import clsx from 'clsx';

interface User {
  id: string;
  email: string;
  role: string;
}

interface LogResponse {
  logs: string[];
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<User[]>('/admin/users');
      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get<LogResponse>('/admin/logs');
      setLogs(data.logs);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      toast.success(`User ${userToDelete.email} deleted`);
      setUserToDelete(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchLogs();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Console</h1>
        <p className="text-xs text-muted-foreground mt-1">User management and system logs.</p>
      </div>

      <Tabs.Root className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v as 'users' | 'logs')}>
        <Tabs.List className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit mb-6">
          <Tabs.Trigger
            value="users"
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'users'
                ? 'bg-primary/10 text-primary border border-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Users
          </Tabs.Trigger>
          <Tabs.Trigger
            value="logs"
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'logs'
                ? 'bg-primary/10 text-primary border border-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
            )}
          >
            <ScrollText className="h-3.5 w-3.5" />
            System Logs
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="users">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">User ID</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Email</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Role</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-[10px] break-all max-w-[200px]">{u.id}</td>
                        <td className="px-4 py-3 text-foreground font-medium">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                            <Shield className="h-3 w-3" />
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            onClick={() => setUserToDelete(u)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="logs">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="glass-card p-4">
              <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed overflow-auto max-h-[500px] whitespace-pre-wrap scrollbar">
                {logs.length > 0 ? logs.join('\n') : 'No logs available.'}
              </pre>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 border border-white/10 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Confirm User Deletion</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete user <strong className="text-foreground">{userToDelete.email}</strong>? This action cannot be undone and will revoke all API keys and permissions.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 bg-white/5 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white cursor-pointer disabled:opacity-50 shadow-md shadow-rose-500/20"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
