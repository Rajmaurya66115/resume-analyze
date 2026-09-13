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

  // Modal States
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
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/10 text-[#0284c7] flex items-center justify-center font-black text-lg">
              R
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">ResumeReview</span>
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              ATS AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50/70 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Guest Mode ({tokens} Free)</span>
            </div>

            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Upgrade / Tokens
            </button>

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

      {/* Main Container */}
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

        {/* Upload Form */}
        <form onSubmit={handleAnalyze} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

      {/* ----------------------------------------------------------- */}
      {/* Sign In & Sign Up Modal (with Google and GitHub OAuth)      */}
      {/* ----------------------------------------------------------- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {isSignUp ? 'Sign up to keep your scan history and tokens.' : 'Sign in to access your evaluations.'}
            </p>

            {/* Social Logins */}
            <div className="space-y-2.5 mb-5">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-lg text-xs font-semibold text-slate-700 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27a7.195 7.195 0 0 1 0-4.54V6.58H1.25a11.97 11.97 0 0 0 0 10.84l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="w-full flex items-center justify-center gap-2 bg-[#24292F] hover:bg-[#1B1F23] text-white py-2.5 rounded-lg text-xs font-semibold transition"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
                Continue with GitHub
              </button>
            </div>

            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                or
              </span>
            </div>

            {/* Email & Password */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowAuthModal(false);
              }}
              className="space-y-3"
            >
              <input
                type="email"
                required
                placeholder="Email address"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="password"
                required
                placeholder="Password"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="w-full bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold py-2.5 rounded-lg transition mt-2"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-emerald-700 font-semibold hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 3-Tier Pricing / Upgrade Modal                              */}
      {/* ----------------------------------------------------------- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-extrabold text-slate-900 mb-1">Upgrade Your Account</h3>
              <p className="text-xs text-slate-500">
                Choose the best scan plan to optimize your resume for all target jobs.
              </p>
            </div>

            {/* 3-Tier Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tier 1: Starter */}
              <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Starter Pack</h4>
                  <p className="text-xs text-slate-500 mt-0.5">For quick job applications</p>
                  <div className="my-4">
                    <span className="text-3xl font-black text-slate-900">₹99</span>
                    <span className="text-xs text-slate-400"> / one-time</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> 20 ATS Scans
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Keyword Gap Analysis
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Standard Support
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                >
                  Select Pack
                </button>
              </div>

              {/* Tier 2: Pro (Featured) */}
              <div className="border-2 border-emerald-600 bg-emerald-50/30 rounded-xl p-5 flex flex-col justify-between relative shadow-sm">
                <span className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Popular
                </span>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Pro Pack</h4>
                  <p className="text-xs text-slate-500 mt-0.5">For active job hunters</p>
                  <div className="my-4">
                    <span className="text-3xl font-black text-emerald-700">₹299</span>
                    <span className="text-xs text-slate-400"> / one-time</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> 100 ATS Scans
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Deep Keyword Matching
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Format Audit & Tips
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full py-2 bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold rounded-lg transition"
                >
                  Select Pack
                </button>
              </div>

              {/* Tier 3: Unlimited */}
              <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Unlimited</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Uncapped access</p>
                  <div className="my-4">
                    <span className="text-3xl font-black text-slate-900">₹699</span>
                    <span className="text-xs text-slate-400"> / month</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Unlimited Scans
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Priority Parsing Speed
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Full Scan History
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
                >
                  Select Pack
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}