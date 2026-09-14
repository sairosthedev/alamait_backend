import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * Inline lease + accrual reconciliation for tenant / debtor detail pages.
 *
 * Usage:
 *   <LeaseAccrualReconciliationPanel applicationId="..." />
 *   <LeaseAccrualReconciliationPanel debtorId="..." />
 *   <LeaseAccrualReconciliationPanel studentId="..." />
 */
const LeaseAccrualReconciliationPanel = ({
  applicationId,
  debtorId,
  studentId,
  apiBase = '',
  onReconciled
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }),
    []
  );

  const statusUrls = useMemo(() => {
    if (applicationId) {
      return [
        `${apiBase}/api/admin/leases/applications/${applicationId}/reconciliation`,
        `${apiBase}/api/admin/rent-accrual-reconciliation/applications/${applicationId}/reconciliation`,
        `${apiBase}/api/finance/rent-accrual-reconciliation/applications/${applicationId}/reconciliation`
      ];
    }
    if (debtorId) {
      return [
        `${apiBase}/api/admin/leases/debtors/${debtorId}/reconciliation`,
        `${apiBase}/api/admin/rent-accrual-reconciliation/debtors/${debtorId}/reconciliation`,
        `${apiBase}/api/finance/rent-accrual-reconciliation/debtors/${debtorId}/reconciliation`
      ];
    }
    if (studentId) {
      return [
        `${apiBase}/api/admin/leases/students/${studentId}/reconciliation`,
        `${apiBase}/api/admin/rent-accrual-reconciliation/students/${studentId}/reconciliation`,
        `${apiBase}/api/finance/rent-accrual-reconciliation/students/${studentId}/reconciliation`
      ];
    }
    return [];
  }, [apiBase, applicationId, debtorId, studentId]);

  const buildFallbackStatus = (application) => {
    const start = application.startDate?.split?.('T')?.[0] || application.startDate || '';
    const end = application.endDate?.split?.('T')?.[0] || application.endDate || '';
    const resolvedApplicationId = application._id || applicationId;

    return {
      inSync: null,
      degraded: true,
      tenant: {
        name: `${application.firstName || ''} ${application.lastName || ''}`.trim(),
        applicationId: resolvedApplicationId,
        studentId: application.student || null,
        debtorCode: null
      },
      applicationLease: {
        startDate: start,
        endDate: end,
        status: application.status,
        applicationCode: application.applicationCode,
        roomNumber: application.allocatedRoomDetails?.roomNumber || application.allocatedRoom || null
      },
      debtorLease: null,
      accruals: {
        leaseStartExists: null,
        expectedMonths: [],
        foundMonths: [],
        missingMonths: [],
        missingCount: null
      },
      issues: [{
        code: 'status_api_unavailable',
        severity: 'warning',
        message: 'Full reconciliation status requires a backend deploy. You can still update lease dates and sync accruals below.'
      }],
      actions: {
        updateLease: {
          application: `/api/admin/leases/applications/${resolvedApplicationId}/lease`
        },
        syncAccruals: {
          application: `/api/admin/leases/applications/${resolvedApplicationId}/sync-accruals`
        }
      }
    };
  };

  const loadStatus = useCallback(async () => {
    if (statusUrls.length === 0) {
      setError('Pass applicationId, debtorId, or studentId');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      let lastError = null;
      for (const url of statusUrls) {
        try {
          const response = await axios.get(url, { headers: authHeaders });
          const data = response.data?.data;
          setStatus(data);
          setStartDate(data?.applicationLease?.startDate || '');
          setEndDate(data?.applicationLease?.endDate || '');
          setLoading(false);
          return;
        } catch (err) {
          lastError = err;
          if (err.response?.status !== 404) {
            throw err;
          }
        }
      }

      if (applicationId) {
        const appResponse = await axios.get(
          `${apiBase}/api/admin/applications/${applicationId}`,
          { headers: authHeaders }
        );
        const application = appResponse.data?.application || appResponse.data?.data || appResponse.data;
        const fallback = buildFallbackStatus(application);
        setStatus(fallback);
        setStartDate(fallback.applicationLease.startDate || '');
        setEndDate(fallback.applicationLease.endDate || '');
        setLoading(false);
        return;
      }

      throw lastError;
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load reconciliation status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, applicationId, authHeaders, statusUrls]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const resolveUpdateUrl = () => {
    const actions = status?.actions?.updateLease;
    if (!actions) return null;
    if (applicationId && actions.application) return `${apiBase}${actions.application}`;
    if (debtorId && actions.debtor) return `${apiBase}${actions.debtor}`;
    if (studentId && actions.student) return `${apiBase}${actions.student}`;
    return actions.application ? `${apiBase}${actions.application}` : null;
  };

  const resolveSyncUrl = () => {
    const actions = status?.actions?.syncAccruals;
    if (!actions) return null;
    if (applicationId && actions.application) return `${apiBase}${actions.application}`;
    if (debtorId && actions.debtor) return `${apiBase}${actions.debtor}`;
    return actions.application ? `${apiBase}${actions.application}` : null;
  };

  const handleSaveLease = async () => {
    const url = resolveUpdateUrl();
    if (!url) {
      setError('Cannot resolve lease update endpoint');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.put(
        url,
        { startDate, endDate },
        { headers: authHeaders }
      );
      const created = response.data?.data?.accrualBackfill?.accrualsCreated ?? 0;
      setMessage(response.data?.message || `Lease saved${created ? ` — ${created} accrual(s) created` : ''}`);
      await loadStatus();
      onReconciled?.(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update lease');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncAccruals = async () => {
    const url = resolveSyncUrl();
    if (!url) {
      setError('Cannot resolve sync accruals endpoint');
      return;
    }

    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(url, {}, { headers: authHeaders });
      const created = response.data?.data?.accrualBackfill?.accrualsCreated ?? 0;
      setMessage(response.data?.message || `Synced — ${created} accrual(s) created`);
      await loadStatus();
      onReconciled?.(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to sync accruals');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Loading lease reconciliation…
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'Unable to load reconciliation data'}
      </div>
    );
  }

  const missingMonths = status.accruals?.missingMonths || [];
  const issues = status.issues || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Lease &amp; accrual reconciliation</h3>
          <p className="text-sm text-gray-600">
            {status.tenant?.name}
            {status.tenant?.debtorCode ? ` · ${status.tenant.debtorCode}` : ''}
            {status.applicationLease?.applicationCode ? ` · ${status.applicationLease.applicationCode}` : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            status.inSync ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {status.inSync ? 'In sync' : `${issues.filter(i => i.severity === 'error').length} issue(s)`}
        </span>
      </div>

      <div className="space-y-4 p-4">
        {message && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Application lease</p>
            <p className="text-sm text-gray-800">
              {status.applicationLease?.startDate} → {status.applicationLease?.endDate}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Status: {status.applicationLease?.status || '—'}
              {status.applicationLease?.roomNumber ? ` · Room ${status.applicationLease.roomNumber}` : ''}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Debtor lease</p>
            {status.debtorLease ? (
              <p className="text-sm text-gray-800">
                {status.debtorLease.startDate} → {status.debtorLease.endDate}
              </p>
            ) : (
              <p className="text-sm text-gray-500">No debtor lease info</p>
            )}
            {status.debtorFinancials && (
              <p className="mt-1 text-xs text-gray-500">
                Balance ${Number(status.debtorFinancials.currentBalance || 0).toFixed(2)} · Paid $
                {Number(status.debtorFinancials.totalPaid || 0).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveLease}
            disabled={saving || syncing}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save lease & create accruals'}
          </button>
          <button
            type="button"
            onClick={handleSyncAccruals}
            disabled={saving || syncing || (!status.degraded && missingMonths.length === 0)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncing
              ? 'Syncing…'
              : status.degraded
                ? 'Sync accruals'
                : `Sync missing accruals (${missingMonths.length})`}
          </button>
          <button
            type="button"
            onClick={loadStatus}
            disabled={saving || syncing}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {issues.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Issues</p>
            <ul className="space-y-1 text-sm">
              {issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={`rounded px-2 py-1 ${
                    issue.severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-800">Monthly accruals (through today)</p>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(status.accruals?.expectedMonths || []).map((monthKey) => {
                  const found = (status.accruals?.foundMonths || []).find((f) => f.month === monthKey);
                  const isMissing = missingMonths.includes(monthKey);
                  return (
                    <tr key={monthKey} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono">{monthKey}</td>
                      <td className="px-3 py-2">
                        {isMissing ? (
                          <span className="text-red-700">Missing</span>
                        ) : (
                          <span className="text-green-700">Posted</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {found?.amount != null ? `$${Number(found.amount).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {(status.accruals?.expectedMonths || []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                      No monthly accruals expected yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!status.accruals?.leaseStartExists && status.applicationLease?.startDate && (
            <p className="mt-2 text-sm text-red-700">Lease start accrual is missing</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaseAccrualReconciliationPanel;
