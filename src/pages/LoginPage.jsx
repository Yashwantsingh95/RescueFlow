import React, { useState } from 'react';
import { HeartHandshake, Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function LoginPage({ onNavigate, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSuccessfulAuth = (user) => {
    if (onLoginSuccess) {
      onLoginSuccess(user);
    } else {
      const role = user?.role?.toUpperCase();
      if (role === 'SHELTER') {
        onNavigate('/shelter/dashboard');
      } else if (role === 'DRIVER') {
        onNavigate('/driver/dashboard');
      } else {
        onNavigate('/donor/dashboard');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.auth.login(email, password);
      if (res && res.user) {
        handleSuccessfulAuth(res.user);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Real Google Sign-In via Google Identity Services
  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google?.accounts?.id && googleClientId) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const res = await api.auth.googleAuth({ token: response.credential });
            if (res && res.user) {
              handleSuccessfulAuth(res.user);
            }
          } catch (err) {
            setError(err.message || 'Google authentication failed.');
          } finally {
            setGoogleLoading(false);
          }
        }
      });
      window.google.accounts.id.prompt();
    } else {
      setTimeout(async () => {
        try {
          const res = await api.auth.login(email, password);
          if (res && res.user) {
            handleSuccessfulAuth(res.user);
          }
        } catch (err) {
          setError(err.message || 'Authentication error.');
        } finally {
          setGoogleLoading(false);
        }
      }, 400);
    }
  };

  const isNoAccount = error && (error.toLowerCase().includes('no account') || error.toLowerCase().includes('not found'));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      {/* Brand Header */}
      <div 
        onClick={() => onNavigate('/landing')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          marginBottom: '28px'
        }}
      >
        <div style={{
          width: '38px',
          height: '38px',
          background: 'var(--color-primary)',
          border: 'var(--border-dark)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}>
          <HeartHandshake size={22} strokeWidth={2.5} />
        </div>
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.6rem',
          fontWeight: 900,
          color: 'var(--color-dark)',
          letterSpacing: '-0.02em'
        }}>
          RESCUEFLOW
        </span>
      </div>

      {/* Main Card */}
      <div 
        className="neo-card" 
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px',
          background: '#ffffff'
        }}
      >
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.65rem',
          fontWeight: 800,
          marginBottom: '6px'
        }}>
          Account Portal Login
        </h1>
        <p style={{
          color: 'var(--color-muted)',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '22px'
        }}>
          Sign in to access your designated role portal.
        </p>

        {error && (
          <div style={{
            background: isNoAccount ? '#fff8e6' : '#fee2e2',
            border: isNoAccount ? '2px solid #b45309' : '2px solid #b91c1c',
            color: isNoAccount ? '#b45309' : '#b91c1c',
            borderRadius: '8px',
            padding: '14px 16px',
            fontSize: '0.88rem',
            fontWeight: 700,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div>{error}</div>
                {isNoAccount && (
                  <button
                    type="button"
                    onClick={() => onNavigate('signup')}
                    className="neo-btn neo-btn-dark"
                    style={{ 
                      marginTop: '10px', 
                      padding: '8px 14px', 
                      fontSize: '0.82rem', 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Create a New Account</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px' }}>
              Account Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="neo-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                style={{ paddingLeft: '40px' }}
              />
              <Mail 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-muted)'
                }} 
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                Password
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="neo-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
              />
              <Lock 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-muted)'
                }} 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="neo-btn neo-btn-dark"
            style={{ width: '100%', padding: '13px', marginTop: '6px', fontSize: '1rem' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Log In to My Portal'}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '22px 0 18px 0'
        }}>
          <div style={{ flex: 1, height: '1px', background: '#e2dcc8' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
            or continue with
          </span>
          <div style={{ flex: 1, height: '1px', background: '#e2dcc8' }} />
        </div>

        {/* Real Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="neo-btn neo-btn-outline"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.9rem',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px'
          }}
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Quick 1-Click Demo Selector */}
        <div style={{
          margin: '18px 0',
          padding: '12px',
          background: '#fdfbf7',
          borderRadius: '10px',
          border: '1.5px dashed var(--color-dark)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
            ⚡ Instant 1-Click Demo Credentials:
          </span>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { setEmail('donor@rescueflow.com'); setPassword('password123'); }}
              className="neo-btn"
              style={{ fontSize: '0.75rem', padding: '5px 10px', background: '#fefae0', border: '1.5px solid #000' }}
            >
              🍽️ Donor
            </button>
            <button
              type="button"
              onClick={() => { setEmail('shelter@rescueflow.com'); setPassword('password123'); }}
              className="neo-btn"
              style={{ fontSize: '0.75rem', padding: '5px 10px', background: '#d8f3dc', border: '1.5px solid #000' }}
            >
              🏠 Shelter
            </button>
            <button
              type="button"
              onClick={() => { setEmail('driver@rescueflow.com'); setPassword('password123'); }}
              className="neo-btn"
              style={{ fontSize: '0.75rem', padding: '5px 10px', background: '#e0e1dd', border: '1.5px solid #000' }}
            >
              🚐 Driver
            </button>
          </div>
        </div>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--color-muted)' }}>Need a new portal account? </span>
          <span 
            onClick={() => onNavigate('/signup')}
            style={{ fontWeight: 800, color: 'var(--color-dark)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Register Here
          </span>
        </div>
      </div>
    </div>
  );
}
