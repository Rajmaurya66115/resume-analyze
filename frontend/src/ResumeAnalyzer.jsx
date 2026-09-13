import React, { useState, useEffect, useCallback } from 'react';
import { fetchTokenStatus, analyzeResume, logout } from './api';
import AuthModal from './AuthModal';
import PurchaseModal from './PurchaseModal';

const INK = '#1E2A28';
const PAPER = '#EDEAE1';
const STAMP = '#2F6F5E';
const GOLD = '#B8874A';
const RUST = '#A8492E';

function Stamp({ tokensLeft, scope, plan, onClick }) {
  const low = tokensLeft !== null && tokensLeft <= (scope === 'guest' ? 2 : 3);
  return (
    <div
      onClick={onClick}
      className="inline-flex flex-col items-center justify-center rounded-full border-2 px-4 py-3 rotate-[-4deg] select-none cursor-pointer transition-transform hover:scale-105"
      title="Click to view plans or get more tokens"
      style={{ borderColor: low ? RUST : STAMP, color: low ? RUST : STAMP }}
    >
      <span className="text-[10px] tracking-wide uppercase font-sans">
        {scope === 'guest' ? 'Free tokens' : plan}
      </span>
      <span className="text-2xl font-serif leading-none">
        {tokensLeft === null ? '∞' : tokensLeft}
      </span>
    </div>
  );
}

function UploadPanel({ onFileSelected, fileName, busy }) {
  return (
    <label
      className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 md:p-12 cursor-pointer transition-colors hover:bg-black/5"
      style={{ borderColor: INK }}
    >
      <input
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        disabled={busy}
        onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
      />
      <p className="font-serif text-lg md:text-xl" style={{ color: INK }}>
        {fileName || 'Drop your resume here'}
      </p>
      <p className="font-sans text-sm mt-2 opacity-60">PDF or DOCX, up to 10MB</p>
    </label>
  );
}

function FeedbackList({ title, items, accent }) {
  if (!items?.length) return null;
  return (
    <div className="mb-5">
      <h3 className="font-sans text-sm font-semibold mb-2" style={{ color: accent }}>
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="font-sans text-sm leading-relaxed pl-3 border-l-2"
            style={{ borderColor: accent }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResumeAnalyzer() {
  const [tokenStatus, setTokenStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const isLoggedIn = Boolean(localStorage.getItem('auth_token'));

  const loadTokens = useCallback(() => {
    fetchTokenStatus().then(setTokenStatus).catch(() => {});
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleAnalyze = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = await analyzeResume(file);
      setResult(data);
      setTokenStatus((prev) => ({ ...prev, tokensLeft: data.tokensLeft }));
    } catch (err) {
      if (err.code === 'tokens_exhausted') {
        setError({ blocked: true, message: err.message });
        if (isLoggedIn) {
          setShowPurchaseModal(true);
        } else {
          setShowAuthModal(true);
        }
      } else {
        setError({ blocked: false, message: err.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStampClick = () => {
    if (isLoggedIn) {
      setShowPurchaseModal(true);
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-14">
        <header className="flex items-start justify-between mb-8 md:mb-12">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl">Resume Review</h1>
            <p className="text-sm opacity-70 mt-1">Upload once, see exactly what to fix.</p>
          </div>
          <div className="flex items-center gap-4">
            {tokenStatus && (
              <Stamp
                tokensLeft={tokenStatus.tokensLeft}
                scope={tokenStatus.scope}
                plan={tokenStatus.plan}
                onClick={handleStampClick}
              />
            )}
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="text-xs px-3 py-2 rounded font-medium shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: STAMP, color: '#ffffff' }}
                >
                  Get Tokens
                </button>
                <button
                  onClick={() => {
                    logout();
                    loadTokens();
                  }}
                  className="text-xs px-3 py-2 rounded border font-medium transition-colors hover:bg-black/5"
                  style={{ borderColor: INK, color: INK }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs px-3 py-2 rounded font-medium shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: INK, color: PAPER }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="grid md:grid-cols-5 gap-8 md:gap-10">
          <div className="md:col-span-2">
            <UploadPanel
              onFileSelected={(f) => {
                setFile(f);
                setResult(null);
                setError(null);
              }}
              fileName={file?.name}
              busy={busy}
            />
            <button
              onClick={handleAnalyze}
              disabled={!file || busy}
              className="w-full mt-4 py-3 rounded-md font-sans text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: INK, color: PAPER }}
            >
              {busy ? 'Reading your resume…' : 'Analyze resume'}
            </button>

            {error && (
              <div
                className="mt-4 p-4 rounded-md border text-sm"
                style={{ borderColor: RUST, color: RUST, backgroundColor: '#fff' }}
              >
                <p className="font-medium">{error.message}</p>
                {error.blocked && (
                  <button
                    onClick={() => (isLoggedIn ? setShowPurchaseModal(true) : setShowAuthModal(true))}
                    className="mt-2 underline font-sans text-sm block"
                    style={{ color: INK }}
                  >
                    {isLoggedIn ? 'Buy more tokens' : 'Sign in to continue'}
                  </button>
                )}
                {!error.blocked && (
                  <button
                    onClick={handleAnalyze}
                    className="mt-2 underline font-sans text-sm"
                    style={{ color: INK }}
                  >
                    Retry — no token was used
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {result ? (
              <div className="bg-white/60 rounded-lg p-6 md:p-8">
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-serif text-5xl">{result.score}</span>
                  <span className="text-sm opacity-60">/ 100</span>
                </div>
                <FeedbackList title="Strengths" items={result.feedback.strengths} accent={STAMP} />
                <FeedbackList title="Weak points" items={result.feedback.weakPoints} accent={RUST} />
                <FeedbackList title="Missing skills" items={result.feedback.missingSkills} accent={GOLD} />
                <FeedbackList title="Improvement tips" items={result.feedback.improvementTips} accent={INK} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm opacity-50 py-16 md:py-0">
                Your score and feedback will appear here.
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => loadTokens()}
      />

      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        token={localStorage.getItem('auth_token')}
        onPurchaseSuccess={() => loadTokens()}
      />
    </div>
  );
}