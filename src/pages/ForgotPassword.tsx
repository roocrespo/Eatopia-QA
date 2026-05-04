import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={blobStyle1} />
      <div style={blobStyle2} />

      <div style={cardStyle}>
        {/* Back button */}
        <Link
          to="/login"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '2rem', transition: 'color 0.2s' }}
        >
          <ArrowLeft size={15} /> Voltar ao login
        </Link>

        {!sent ? (
          <>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={logoIconStyle}>
                <Mail size={26} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem', marginTop: '1.25rem' }}>
                Recuperar senha
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                Digite seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
            </div>

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Seu e-mail</label>
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

              {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem' }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={submitBtnStyle}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Enviando...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Send size={16} /> Enviar link de recuperação
                  </span>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Success State */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ ...logoIconStyle, background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)' }}>
              <CheckCircle size={28} color="#fff" />
            </div>
            <h2 style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800, marginTop: '1.5rem', marginBottom: '0.75rem' }}>
              E-mail enviado!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.9rem' }}>
              Verifique sua caixa de entrada em <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{email}</strong> e clique no link para redefinir sua senha.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{ ...submitBtnStyle, background: 'rgba(255,255,255,0.08)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Voltar ao login
            </button>
          </div>
        )}
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
  right: '-10%',
  width: '50vw',
  height: '50vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const blobStyle2: React.CSSProperties = {
  position: 'absolute',
  bottom: '-10%',
  left: '-10%',
  width: '40vw',
  height: '40vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
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
  width: 60,
  height: 60,
  borderRadius: '14px',
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
  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
  letterSpacing: '0.02em',
};
