import React, { useState, useEffect } from 'react';

export default function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Dynamic Token & History States
  const [tokens, setTokens] = useState(10);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  // 1. Persistent Device Fingerprint Identifier
  const getDeviceId = () => {
    let id = localStorage.getItem('x_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('x_device_id', id);
    }
    return id;
  };

  // Helper: Request Headers with Auth + Device ID
  const getHeaders = () => {
    const headers = {
      'x-device-id': getDeviceId(),
    };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // 2. Fetch Live Token Balance from MongoDB
  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/analyze/tokens', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && typeof data.tokens === 'number') {
        setTokens(data.tokens);
      }
    } catch (err) {
      console.error('Failed to sync tokens:', err);
    }
  };

  // 3. Fetch Analysis History from MongoDB
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/analyze/history', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.history)) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // 4. Initial Load
  useEffect(() => {
    fetchTokens();
    fetchHistory();
  }, []);

  // 5. Scan Submission
  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload a resume file (PDF/DOCX).');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste a job description.');
      return;
    }

    setIsScanning(true);
    setError(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error processing resume.');
      }

      setResult(data);

      // Decrement token count in UI
      if (typeof data.remainingTokens === 'number') {
        setTokens(data.remainingTokens);
      } else {
        fetchTokens();
      }

      // Refresh history list immediately
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navbar */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-white font-black text-xl px-2.5 py-1 rounded-md">R</span>
            <span className="font-bold text-xl tracking-tight">ResumeReview</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">ATS AI</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic Token Badge */}
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {user ? `Tokens: ${tokens}` : `Guest Mode (${tokens} Free)`}
            </span>

            <button className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-1.5 rounded-md transition">
              Upgrade / Tokens
            </button>
            <button className="text-sm font-medium border border-slate-300 hover:bg-slate-100 px-4 py-1.5 rounded-md transition">
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Match Your Resume to Any Job in Seconds
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
            Scan your resume against employer requirements. Uncover missing industry keywords,
            formatting errors, and algorithmic match scores before submitting.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleAnalyze} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Resume File */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                1. Upload Resume
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-emerald-500 transition">
                <input
                  type="file"
                  id="resumeUpload"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <label htmlFor="resumeUpload" className="cursor-pointer flex flex-col items-center">
                  <span className="text-2xl mb-1">📄</span>
                  <span className="text-sm font-medium text-slate-700">
                    {file ? file.name : 'Browse File'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Supports PDF up to 5MB</span>
                </label>
              </div>
            </div>

            {/* 2. Job Description */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                2. Job Description
              </label>
              <textarea
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description or key requirements here..."
                className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isScanning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {isScanning ? 'Analyzing ATS Match...' : 'Run ATS Compatibility Scan'}
            </button>
          </div>
        </form>

        {/* Detailed Scan Results */}
        {result && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm mb-10 space-y-8">
            {/* Header / Overall Score */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div>
                <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">
                  ATS Scan Completed
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">Detailed Analysis Report</h2>
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-100">
                <span className="text-xs font-semibold uppercase text-emerald-800 tracking-wide">
                  Overall Score
                </span>
                <span className="text-3xl font-black text-emerald-600">{result.score}%</span>
              </div>
            </div>

            {/* Score Categories Breakdown */}
            {result.categories && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Category Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500">Keyword Alignment</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">
                      {result.categories.keywordMatch}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500">Experience Match</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">
                      {result.categories.experienceFit}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500">Formatting Check</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">
                      {result.categories.formatting}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Keywords Match & Gap Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Matched Keywords */}
              <div className="p-5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-950">Matched Keywords</h3>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {result.matchedKeywords?.length || 0} Found
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.matchedKeywords && result.matchedKeywords.length > 0 ? (
                    result.matchedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200"
                      >
                        ✓ {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-600 italic">No direct keyword overlaps detected.</span>
                  )}
                </div>
              </div>

              {/* Missing Keywords */}
              <div className="p-5 bg-rose-50/60 rounded-xl border border-rose-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-rose-950">Missing Required Skills</h3>
                  <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    {result.missingKeywords?.length || 0} Missing
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords && result.missingKeywords.length > 0 ? (
                    result.missingKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium bg-rose-100 text-rose-800 px-2.5 py-1 rounded-md border border-rose-200"
                      >
                        ✕ {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-rose-600 italic">All key JD terms are covered.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Formatting Alerts */}
            {result.formattingAlerts && result.formattingAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Parser Checks & Structure
                </h3>
                <div className="space-y-2">
                  {result.formattingAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-lg text-xs font-medium flex items-start gap-2.5 border ${
                        alert.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <span>{alert.type === 'success' ? '✔' : '⚠'}</span>
                      <span>{alert.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scan History Feed */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Scan History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No scans recorded yet. Run your first scan above.</p>
          ) : (
            <div className="divide-y">
              {history.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.fileName}</p>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-emerald-600">{item.score}% Score</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}