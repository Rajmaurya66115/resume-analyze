import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { signup, login, getDeviceId, setAuthToken } from './api';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Google OAuth Success Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': getDeviceId(),
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Google authentication failed');
      }

      if (data.token) {
        setAuthToken(data.token);
      }
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  // GitHub Redirect Handler
  const handleGitHubLogin = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError('GitHub Client ID missing in frontend .env');
      return;
    }
    const redirectUri = window.location.origin;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  // Apple Sign-In handler commented out
  /*
  const handleAppleClick = () => {
    setError('Apple Sign-In requires an active Apple Developer Program account.');
  };
  */

  // Form Submit (Email / Password)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await login(email, password);
      } else {
        data = await signup(email, password);
      }
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
        >
          &times;
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {isLogin ? 'Welcome Back' : 'Create an Account'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {isLogin
            ? 'Sign in to access your previous analyses and plan.'
            : 'Sign up to link your history and unlock account features.'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Social Authentication */}
        <div className="space-y-3 mb-6">
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in was cancelled or failed.')}
              shape="rectangular"
              size="large"
              width="100%"
            />
          </div>

          <button
            type="button"
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </button>

          {/* Apple Sign-In button commented out
          <button
            type="button"
            onClick={handleAppleClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.66-7.79-11.88-14.23-6.64-10.12-11.96-21.72-15.96-34.8-4-13.08-6-25.04-6-35.88 0-15.82 4.14-29.07 12.42-39.75 8.28-10.68 18.73-16.14 31.36-16.37 4.9.11 10.19 1.25 15.88 3.42 5.68 2.17 9.4 3.35 11.16 3.52 2.22-.34 6.13-1.63 11.73-3.87 5.6-2.24 10.45-3.26 14.56-3.07 12.3.57 22.39 4.8 30.26 12.7-10.77 6.53-16.03 15.54-15.8 27.04.23 9.44 3.84 17.27 10.82 23.49 4.02 3.57 8.57 6.07 13.65 7.51-2.9 8.51-6.52 17.07-10.84 25.68zM119.22 33.64c-.11-2.61.42-5.46 1.6-8.54 1.18-3.08 2.82-5.88 4.93-8.4 2.33-2.73 5.09-4.87 8.27-6.42 3.18-1.55 6.35-2.38 9.5-2.5-.23 2.73-.87 5.63-1.93 8.7-1.06 3.08-2.67 5.86-4.83 8.35-2.27 2.61-5.06 4.67-8.37 6.18-3.3 1.51-6.36 2.4-9.17 2.63z" />
            </svg>
            Continue with Apple
          </button>
          */}
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-3 text-xs text-slate-400 uppercase font-semibold">Or with email</span>
          <div className="border-t border-slate-200 w-full"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-emerald-700 font-semibold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}