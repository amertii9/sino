import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateTime } from '../../utils/formatters';
import { ShieldCheck, Search, RefreshCw } from 'lucide-react';

export const AuditLogsView = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await api.get('/audit-logs');
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(l => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      l.user_name?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      l.entity?.toLowerCase().includes(s) ||
      l.new_value?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" /> {t('audit_title', 'System Financial Audit Trail')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('audit_sub', 'Immutable log of all financial changes, trip submissions, cancellations, and fuel approvals')}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder={t('search', 'Search audit trail by user, action, or record...')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor / User</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-3">Previous State</th>
                <th className="py-3 px-3">New / Recorded State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-800/50">
                  <td className="py-3 px-3 text-slate-400 font-mono whitespace-nowrap">
                    {formatDateTime(l.timestamp)}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-200">{l.user_name}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-300">{l.entity}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px] max-w-xs truncate">
                    {l.old_value || '-'}
                  </td>
                  <td className="py-3 px-3 text-emerald-300 font-mono text-[11px] max-w-sm truncate">
                    {l.new_value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
