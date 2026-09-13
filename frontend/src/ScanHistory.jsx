import React, { useEffect, useState } from 'react';

export default function ScanHistory({ refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/analyze/history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="text-slate-400 py-6 text-sm text-center">
        Loading scan history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-slate-500 py-6 text-sm text-center border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm">
        No recent scans found. Upload a resume above to begin!
      </div>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Recent Analyses</h2>
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600">
          Last {history.length} Scans
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {history.map((item, index) => (
          <div
            key={item._id || index}
            className="py-3.5 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-800 truncate max-w-xs sm:max-w-md">
                {item.fileName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div>
              {item.score !== null ? (
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    item.score >= 80
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : item.score >= 60
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {item.score}% Match
                </span>
              ) : (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500">
                  {item.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}