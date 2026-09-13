import React, { useState, useEffect } from 'react';

export default function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Token & History State
  const [tokens, setTokens] = useState(10);
  const [history, setHistory] = useState([]);

  // Frontend-only Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 1. Device Identifier for Guest Mode
  const getDeviceId = () => {
    let id = localStorage.getItem('x_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('x_device_id', id);
    }
    return id;
  };

  // Helper: Request Headers
  const getHeaders = () => ({
    'x-device-id': getDeviceId(),
  });

  // 2. Fetch Live Token Balance from MongoDB
  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/analyze/tokens', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && typeof data.tokens === 'number') {
        setTokens(data.tokens);
      }
    } catch (err) {
      console.error('Failed to sync tokens:', err);
    }
  };

  // 3. Fetch Scan History from MongoDB
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/analyze/history', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.history)) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    fetchTokens();
    fetchHistory();
  }, []);

  // 4. Scan Submission Handler
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

      if (typeof data.remainingTokens === 'number') {
        setTokens(data.remainingTokens);
      } else {
        fetchTokens();
      }

      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Top Navbar Matching Original Screenshot */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/10 text-[#0284c7] flex items-center justify-center font-black text-lg">
              R
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">ResumeReview</span>
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              ATS AI
            </span>
          </div>

          {/* Original Right-side Actions */}
          <div className="flex items-center gap-3">
            {/* Pill matching screenshot: Green dot + text */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50/70 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Guest Mode ({tokens} Free)</span>
            </div>

            {/* Upgrade Button */}
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Upgrade / Tokens
            </button>

            {/* Sign In Button */}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setShowAuthModal(true);
              }}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Match Your Resume to Any Job in Seconds
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-base">
            Scan your resume against employer requirements. Uncover missing industry keywords,
            formatting errors, and algorithmic match scores before submitting.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Upload Form (Border and layout from original screenshot) */}
        <form onSubmit={handleAnalyze} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1. UPLOAD RESUME */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                1. UPLOAD RESUME
              </label>
              <div className="border-2 border-dashed border-emerald-400/80 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-white">
                <div className="text-3xl mb-2 text-slate-700">📄</div>
                <p className="text-sm font-semibold text-slate-800 mb-1">
                  {file ? file.name : 'Upload your resume'}
                </p>
                <p className="text-xs text-slate-400 mb-4">Supports PDF and DOCX up to 5MB</p>

                <input
                  type="file"
                  id="resumeInput"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <label
                  htmlFor="resumeInput"
                  className="cursor-pointer text-xs font-semibold px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Browse File
                </label>
              </div>
            </div>

            {/* 2. JOB DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                2. JOB DESCRIPTION
              </label>
              <textarea
                rows={7}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Web Development requirements, qualifications, and skills..."
                className="w-full text-sm border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={isScanning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {isScanning ? 'Analyzing ATS Match...' : 'Run ATS Compatibility Scan'}
            </button>
          </div>
        </form>

        {/* Detailed Results Output */}
        {result && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs mb-10 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analysis Breakdown</h2>
                <span className="text-xs text-slate-400">Scan overview</span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-emerald-600">{result.score}%</span>
              </div>
            </div>

            {result.categories && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Keyword Alignment</p>
                  <p className="text-2xl font-bold text-slate-800">{result.categories.keywordMatch}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Experience Match</p>
                  <p className="text-2xl font-bold text-slate-800">{result.categories.experienceFit}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Formatting Check</p>
                  <p className="text-2xl font-bold text-slate-800">{result.categories.formatting}%</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-950 mb-2">Matched Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedKeywords?.map((kw, i) => (
                    <span key={i} className="text-xs bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded">
                      ✓ {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                <h3 className="text-sm font-bold text-rose-950 mb-2">Missing Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingKeywords?.map((kw, i) => (
                    <span key={i} className="text-xs bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded">
                      ✕ {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan History Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 mb-4">Scan History</h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No past scans found for this session.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.fileName}</p>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{item.score}% Score</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Frontend-only Sign In Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative shadow-xl">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {isSignUp ? 'Create an Account' : 'Sign In'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your email and password to continue.
            </p>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="w-full bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold py-2.5 rounded-lg transition"
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-emerald-700 hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frontend-only Upgrade / Tokens Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl">
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Upgrade / Tokens</h3>
            <p className="text-xs text-slate-500 mb-5">
              Choose a token bundle to run more resume evaluations.
            </p>
            <div className="space-y-3">
              <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Starter Pack</h4>
                  <p className="text-[11px] text-slate-500">20 ATS Resume Scans</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-700">₹99</span>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(false)}
                    className="text-xs bg-[#0f766e] hover:bg-[#115e59] text-white font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Select
                  </button>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Pro Pack</h4>
                  <p className="text-[11px] text-slate-500">100 ATS Resume Scans</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800">₹299</span>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(false)}
                    className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}