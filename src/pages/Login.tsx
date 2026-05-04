import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError('E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      {/* Background gradient blobs */}
      <div style={blobStyle1} />
      <div style={blobStyle2} />

      <div style={cardStyle}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={logoIconStyle}>
            <span style={{ fontSize: '1.75rem' }}>⚡</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem', marginTop: '1rem' }}>
            Eatopia QA
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.9rem' }}>
            Plataforma de Qualidade de Atendimento
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Email */}
          <div>
            <label style={labelStyle}>E-mail</label>
            <div style={inputWrapperStyle}>
              <Mail size={16} style={inputIconStyle} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={inputWrapperStyle}>
              <Lock size={16} style={inputIconStyle} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle, paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
            <Link to="/forgot-password" style={{ color: 'rgba(139, 92, 246, 0.9)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>
              Esqueceu a senha?
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={submitBtnStyle}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                Entrando...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={18} /> Entrar
              </span>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px rgba(30, 27, 60, 0.95) inset !important;
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff;
        }
      `}</style>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #0B0C10 0%, #111218 50%, #0f0a1e 100%)',
  position: 'relative',
  overflow: 'hidden',
};

const blobStyle1: React.CSSProperties = {
  position: 'absolute',
  top: '-10%',
  left: '-10%',
  width: '50vw',
  height: '50vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const blobStyle2: React.CSSProperties = {
  position: 'absolute',
  bottom: '-10%',
  right: '-10%',
  width: '40vw',
  height: '40vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  width: '100%',
  maxWidth: '420px',
  margin: '1rem',
  backgroundColor: 'rgba(17, 18, 24, 0.85)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '20px',
  padding: '2.5rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
};

const logoIconStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '16px',
  background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  boxShadow: '0 8px 25px rgba(139, 92, 246, 0.4)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '0.85rem',
  color: 'rgba(255,255,255,0.3)',
  pointerEvents: 'none',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.85rem 0.75rem 2.5rem',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  color: '#FFFFFF',
  fontSize: '0.95rem',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const submitBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.85rem',
  background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  border: 'none',
  borderRadius: '10px',
  color: '#FFFFFF',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '0.5rem',
  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
  transition: 'transform 0.15s, box-shadow 0.15s',
  letterSpacing: '0.02em',
};
