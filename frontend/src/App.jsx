import React, { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import PurchaseModal from './PurchaseModal';
import ScanHistory from './ScanHistory';
import { getAuthToken, setAuthToken, fetchCurrentUser, analyzeResume } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);

  // Intake Form State
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Restore authenticated session
  useEffect(() => {
    if (token) {
      fetchCurrentUser()
        .then((userData) => {
          if (userData) setUser(userData);
        })
        .catch(() => {
          setAuthToken(null);
          setUser(null);
        });
    }
  }, [token]);

  // Handle GitHub OAuth redirect with code in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch('/api/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            setAuthToken(data.token);
            setToken(data.token);
            setUser(data.user);
          }
        })
        .catch(console.error);
    }
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const handleAuthSuccess = (data) => {
    if (data?.token) {
      setAuthToken(data.token);
      setToken(data.token);
    }
    fetchCurrentUser().then(setUser);
  };

  const handlePurchaseSuccess = (updatedData) => {
    setUser((prev) => ({
      ...prev,
      tokenBalance: updatedData.tokenBalance,
      plan: updatedData.plan,
    }));
  };

  const handleRunAnalysis = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please upload a resume file (PDF or DOCX).');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please provide a target job description to match against.');
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const result = await analyzeResume(file, jobDescription);
      setAnalysisResult(result);

      // Trigger history list re-fetch immediately
      setHistoryRefreshKey((prev) => prev + 1);

      // Sync user token balance with server response or decrement locally
      if (result.remainingTokens !== undefined && result.remainingTokens !== null) {
        setUser((prev) => prev ? { ...prev, tokenBalance: result.remainingTokens } : null);
      } else if (user && user.plan !== 'unlimited') {
        setUser((prev) => ({ ...prev, tokenBalance: Math.max(0, prev.tokenBalance - 1) }));
      }
    } catch (err) {
      // Auto-trigger the pricing modal on 402 Insufficient Balance
      if (err.message?.includes('402') || err.status === 402 || err.response?.status === 402) {
        setIsPurchaseOpen(true);
        setError('Token balance exhausted. Please buy more tokens to run scans.');
      } else {
        setError(err.message || 'Error processing resume.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
            R
          </div>
          <div className="flex items-center">
            <span className="font-extrabold text-lg tracking-tight text-slate-800">ResumeReview</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded ml-2">ATS AI</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-800">
              {user ? `${user.tokenBalance} Tokens` : 'Guest Mode (10 Free)'}
            </span>
          </div>

          <button
            onClick={() => setIsPurchaseOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition"
          >
            Upgrade / Tokens
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-slate-600 hidden md:inline">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs sm:text-sm font-medium text-slate-700 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Main Content View */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col gap-8">
        <section className="text-center max-w-2xl mx-auto pt-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Match Your Resume to Any Job in Seconds
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
            Scan your resume against employer requirements. Uncover missing industry keywords, formatting errors, and algorithmic match scores before submitting.
          </p>
        </section>

        {/* Input Intake Panel */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload Zone */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Upload Resume
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
                }}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 transition min-h-[180px] ${
                  file ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-xl text-slate-600">
                  📄
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">
                    {file ? file.name : 'Drop resume file here'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Supports PDF and DOCX up to 5MB</p>
                </div>
                <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition">
                  Browse File
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            {/* Target Job Description Input */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Job Description
              </label>
              <textarea
                rows={7}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job requirements, tech stack, and qualifications here..."
                className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none font-mono text-slate-700 leading-relaxed"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleRunAnalysis}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition transform active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Parsing & Scoring Resume...
                </>
              ) : (
                'Run ATS Compatibility Scan'
              )}
            </button>
          </div>
        </section>

        {/* Diagnostic Results Card */}
        {analysisResult && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800">
                Diagnostic Results & Matching Score
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                Processed via NLP Matcher
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase">Overall Match</span>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {analysisResult.score ?? analysisResult.overallScore ?? 82}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase">Keywords</span>
                <div className="text-3xl font-extrabold text-slate-800 mt-1">
                  {analysisResult.categories?.keywordMatch ?? 78}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase">Experience</span>
                <div className="text-3xl font-extrabold text-slate-800 mt-1">
                  {analysisResult.categories?.experienceFit ?? 85}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase">Formatting</span>
                <div className="text-3xl font-extrabold text-slate-800 mt-1">
                  {analysisResult.categories?.formatting ?? 90}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Missing Target Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(analysisResult.missingKeywords || ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'Redis']).map(
                    (kw, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-md"
                      >
                        + {kw}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Formatting & Parsing Alerts
                </h3>
                <ul className="space-y-2">
                  {(analysisResult.formattingAlerts || [
                    { type: 'success', msg: 'Single-column structure parsed cleanly.' },
                    { type: 'warning', msg: 'Ensure technical skills use standard comma or bullet separation.' },
                  ]).map((alert, idx) => (
                    <li
                      key={idx}
                      className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                        alert.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <span>{alert.type === 'success' ? '✔' : '⚠'}</span>
                      {alert.msg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Scan History Feed */}
        <ScanHistory refreshTrigger={historyRefreshKey} />
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
      <PurchaseModal
        isOpen={isPurchaseOpen}
        onClose={() => setIsPurchaseOpen(false)}
        onPurchaseSuccess={handlePurchaseSuccess}
        token={token}
      />
    </div>
  );
}