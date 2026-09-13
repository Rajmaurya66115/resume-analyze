import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Dynamic Token, History & User States
  const [tokens, setTokens] = useState(10);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  // Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Contact Modal States
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);

  const googleButtonRef = useRef(null);

  // 1. Device Identifier
  const getDeviceId = () => {
    let id = localStorage.getItem('x_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('x_device_id', id);
    }
    return id;
  };

  const getHeaders = () => {
    const headers = { 'x-device-id': getDeviceId() };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // 2. Sync Token Balance from DB
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

  // 3. Sync Scan History from DB
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

  // 4. Restore User Session on Load
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok && data.id) {
            setUser(data);
            if (typeof data.tokenBalance === 'number') setTokens(data.tokenBalance);
          } else {
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch {
          localStorage.removeItem('token');
        }
      }
      fetchTokens();
      fetchHistory();
    };

    restoreSession();
  }, []);

  // 5. Handle Google Sign-In via official renderButton (Avoids FedCM duplicate errors)
  const handleGoogleCredentialResponse = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        if (typeof data.user.tokenBalance === 'number') setTokens(data.user.tokenBalance);
        setShowAuthModal(false);
        fetchTokens();
        fetchHistory();
      } else {
        setAuthError(data.message || 'Google login failed');
      }
    } catch (err) {
      setAuthError('Google sign in error: ' + err.message);
    }
  };

  useEffect(() => {
    if (showAuthModal && !isForgotPassword && window.google && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '915640228399-YOUR_CLIENT_ID.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse,
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'rectangular',
      });
    }
  }, [showAuthModal, isForgotPassword]);

  // 6. Auth Handlers (Signup / Login / Logout / Forgot Password)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    setAuthLoading(true);

    if (isForgotPassword) {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getHeaders() },
          body: JSON.stringify({ email: authEmail }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to process reset request');

        setAuthSuccessMsg('Password reset link sent! Please check your email inbox.');
        setAuthEmail('');
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) {
        setUser(data.user);
        if (typeof data.user.tokenBalance === 'number') setTokens(data.user.tokenBalance);
      }

      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      fetchTokens();
      fetchHistory();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    fetchTokens();
    fetchHistory();
  };

  // 7. Three-Tier Upgrade / Purchase Handler
  const handleBuyPlan = async (planKey) => {
    if (!user) {
      alert('Please sign in or create an account before purchasing a plan.');
      setShowUpgradeModal(false);
      setShowAuthModal(true);
      return;
    }

    try {
      setPurchaseLoading(true);
      const res = await fetch('/api/purchase/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ planKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initialize payment');

      if (data.isMock) {
        await fetch('/api/purchase/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getHeaders() },
          body: JSON.stringify({
            razorpay_order_id: data.orderId,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: 'mock_signature',
            planKey,
          }),
        }).catch(() => null);

        alert(`Payment completed in test mode for ${planKey.toUpperCase()}!`);
        setShowUpgradeModal(false);
        fetchTokens();
        return;
      }

      if (window.Razorpay && data.orderId) {
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'ResumeReview',
          description: `${planKey.toUpperCase()} Plan Purchase`,
          order_id: data.orderId,
          handler: async (response) => {
            const verifyRes = await fetch('/api/purchase/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getHeaders() },
              body: JSON.stringify({
                ...response,
                planKey,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              alert('Payment successful! Your tokens have been credited.');
              setShowUpgradeModal(false);
              fetchTokens();
            } else {
              alert('Payment verification failed: ' + verifyData.message);
            }
          },
        });
        rzp.open();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  // 8. Contact Support Handler
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactStatus(null);
    setContactLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit query');

      setContactStatus({
        type: 'success',
        message: 'Your inquiry has been sent! Check your email for confirmation.',
      });
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');

      setTimeout(() => {
        setShowContactModal(false);
        setContactStatus(null);
      }, 3000);
    } catch (err) {
      setContactStatus({ type: 'error', message: err.message });
    } finally {
      setContactLoading(false);
    }
  };

  // 9. Scan Submission Handler
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
      if (!res.ok) throw new Error(data.message || 'Error processing resume.');

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
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
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
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{user ? `Account (${tokens} Scans)` : `Guest Mode (${tokens} Free)`}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setContactStatus(null);
                setShowContactModal(true);
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition"
            >
              Contact Support
            </button>

            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Upgrade / Tokens
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setIsForgotPassword(false);
                  setAuthError('');
                  setAuthSuccessMsg('');
                  setShowAuthModal(true);
                }}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                Sign In
              </button>
            )}
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
      {/* Sign In, Sign Up & Forgot Password Modal                    */}
      {/* ----------------------------------------------------------- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setIsForgotPassword(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {isForgotPassword
                ? 'Reset Password'
                : isSignUp
                ? 'Create an Account'
                : 'Welcome Back'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {isForgotPassword
                ? 'Enter your registered email to receive a recovery link.'
                : isSignUp
                ? 'Sign up to keep your scan history and tokens.'
                : 'Sign in to access your evaluations.'}
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {authError}
              </div>
            )}

            {authSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
                {authSuccessMsg}
              </div>
            )}

            {/* Google Sign-In Official Mount Container */}
            {!isForgotPassword && (
              <>
                <div className="flex justify-center mb-5">
                  <div ref={googleButtonRef} className="w-full flex justify-center"></div>
                </div>

                <div className="relative flex items-center justify-center mb-5">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                    or
                  </span>
                </div>
              </>
            )}

            {/* Email & Password Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!isForgotPassword && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-600">Password</label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setAuthError('');
                          setAuthSuccessMsg('');
                        }}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password (8+ characters)"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold py-2.5 rounded-lg transition mt-2 disabled:opacity-50"
              >
                {authLoading
                  ? 'Processing...'
                  : isForgotPassword
                  ? 'Send Reset Link'
                  : isSignUp
                  ? 'Create Account'
                  : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 text-center">
              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setAuthError('');
                    setAuthSuccessMsg('');
                  }}
                  className="text-xs text-slate-600 font-semibold hover:underline"
                >
                  ← Back to Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError('');
                    setAuthSuccessMsg('');
                  }}
                  className="text-xs text-emerald-700 font-semibold hover:underline"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Contact Support Modal                                       */}
      {/* ----------------------------------------------------------- */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Contact Support</h3>
            <p className="text-xs text-slate-500 mb-5">
              Have a question or feedback? We will reply to your email promptly.
            </p>

            {contactStatus && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs font-medium border ${
                  contactStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {contactStatus.message}
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Your Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="e.g. Question about Resume ATS Scores"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Message *</label>
                <textarea
                  rows={4}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Describe your inquiry or issue..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={contactLoading}
                className="w-full bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {contactLoading ? 'Sending Inquiry...' : 'Send Message'}
              </button>
            </form>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tier 1: Starter */}
              <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Starter Pack</h4>
                  <p className="text-xs text-slate-500 mt-0.5">For quick applications</p>
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
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={purchaseLoading}
                  onClick={() => handleBuyPlan('starter')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {purchaseLoading ? 'Loading...' : 'Select Pack'}
                </button>
              </div>

              {/* Tier 2: Pro */}
              <div className="border-2 border-emerald-600 bg-emerald-50/30 rounded-xl p-5 flex flex-col justify-between relative shadow-sm">
                <span className="absolute -top-2.5 right-4 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Popular
                </span>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Pro Pack</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Active job hunters</p>
                  <div className="my-4">
                    <span className="text-3xl font-black text-emerald-700">₹249</span>
                    <span className="text-xs text-slate-400"> / one-time</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> 75 ATS Scans
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Deep Keyword Analysis
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={purchaseLoading}
                  onClick={() => handleBuyPlan('pro')}
                  className="w-full py-2 bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {purchaseLoading ? 'Loading...' : 'Select Pack'}
                </button>
              </div>

              {/* Tier 3: Unlimited */}
              <div className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Unlimited</h4>
                  <p className="text-xs text-slate-500 mt-0.5">30 days uncapped</p>
                  <div className="my-4">
                    <span className="text-3xl font-black text-slate-900">₹499</span>
                    <span className="text-xs text-slate-400"> / 30 days</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Unlimited Scans
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Full Scan History
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={purchaseLoading}
                  onClick={() => handleBuyPlan('unlimited')}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {purchaseLoading ? 'Loading...' : 'Select Pack'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}