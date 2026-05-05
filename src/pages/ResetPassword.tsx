import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Save, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      console.log('Verificando sessão antes de atualizar...');
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (!session) {
        throw new Error('Sessão não encontrada. Por favor, clique no link do e-mail novamente.');
      }

      console.log('Iniciando atualização de senha para o usuário:', session.user.id);
      
      // 1. Atualiza a senha no Supabase Auth
      const { data, error: updateError } = await supabase.auth.updateUser({ password: password });
      if (updateError) throw updateError;
      console.log('Senha atualizada no Auth com sucesso.');

      // 2. Atualizar a tabela de colaboradores (tentativa segura)
      const userId = data?.user?.id || session.user.id;
      const userEmail = data?.user?.email || session.user.email;

      try {
        const { error: dbError } = await supabase
          .from('colaboradores')
          .update({ senha_definida: true, status_convite: 'vinculado' })
          .or(`user_id.eq.${userId},email.eq.${userEmail}`);

        if (dbError) console.error('Erro ao sincronizar status do colaborador:', dbError);
        else console.log('Status do colaborador sincronizado com sucesso.');
      } catch (err) {
        console.error('Erro ao tentar sincronizar colaboradores:', err);
      }

      setSuccess(true);
      console.log('Sucesso! Redirecionando em 1.5s...');
      setTimeout(() => window.location.href = '/', 1500);
    } catch (err: any) {
      console.error('Erro crítico no reset de senha:', err);
      setError(err.message || 'Erro ao atualizar senha. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={blobStyle1} />
      <div style={blobStyle2} />

      <div style={cardStyle}>
        {!success ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <div style={logoIconStyle}>
                <Lock size={26} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem', marginTop: '1.25rem' }}>
                Nova Senha
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                Crie uma senha forte para acessar sua conta.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Nova Senha</label>
                <div style={inputWrapperStyle}>
                  <Lock size={16} style={inputIconStyle} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Confirmar Senha</label>
                <div style={inputWrapperStyle}>
                  <Lock size={16} style={inputIconStyle} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={submitBtnStyle}>
                {loading ? 'Atualizando...' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Save size={16} /> Definir Senha
                  </span>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ ...logoIconStyle, background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)' }}>
              <CheckCircle size={28} color="#fff" />
            </div>
            <h2 style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800, marginTop: '1.5rem', marginBottom: '0.75rem' }}>
              Senha definida!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.9rem' }}>
              Sua nova senha foi salva com sucesso. Você será redirecionado para a tela inicial em instantes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Estilos (copiados do ForgotPassword para manter consistência visual premium)
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
