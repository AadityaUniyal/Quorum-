// admin UI page - provides user management and log viewing

'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'react-hot-toast';

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
    } catch (err) {
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
    } catch (err) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <Tabs.Root className="w-full" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <Tabs.List className="flex mb-4 border-b">
          <Tabs.Trigger
            value="users"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Users
          </Tabs.Trigger>
          <Tabs.Trigger
            value="logs"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Logs
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users">
          {loading ? (
            <p>Loading users…</p>
          ) : (
            <table className="min-w-full table-auto border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2 break-all">{u.id}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">{u.role}</td>
                    <td className="px-4 py-2">
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => deleteUser(u.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tabs.Content>
        <Tabs.Content value="logs">
          {loading ? (
            <p>Loading logs…</p>
          ) : (
            <pre className="bg-gray-800 text-white p-4 rounded overflow-auto max-h-96">
              {logs.join('\n')}
            </pre>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
