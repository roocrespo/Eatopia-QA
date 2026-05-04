import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function NewPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    if (!success) return;
    const timer = window.setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [success]);

  useEffect(() => {
    if (success && countdown <= 0) {
      // redirect to home and force reload so Layout refetches user/colaborador
      window.location.href = '/';
    }
  }, [success, countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // 1) confirm session
      const { data: sessionResp } = await supabase.auth.getSession();
      const user = sessionResp?.session?.user;
      if (!user) throw new Error('Sessão inválida. Faça login novamente.');

      // 2) update password in Auth
      const { error: authErr } = await supabase.auth.updateUser({ password });
      if (authErr) throw authErr;

      // 3) poll colaboradores table for senha_definida
      let synced = false;
      const maxAttempts = 10; // ~10s
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data: row, error: selectErr } = await supabase
          .from('colaboradores')
          .select('senha_definida')
          .eq('user_id', user.id)
          .single();

        if (!selectErr && row?.senha_definida === true) {
          synced = true;
          break;
        }

        // wait 1s
        await new Promise(res => setTimeout(res, 1000));
      }

      // 4) fallback: try update collaborators directly
      if (!synced) {
        try {
          const { error: updErr } = await supabase
            .from('colaboradores')
            .update({ senha_definida: true, status_convite: 'vinculado' })
            .eq('user_id', user.id);

          if (!updErr) synced = true;
        } catch (err) {
          // ignore - RLS might block
          console.warn('Fallback update falhou', err);
        }
      }

      setLoading(false);
      setSuccess(true);
      setCountdown(5);

      if (!synced) {
        console.info('Trigger ainda não sincronizou, mas usuário autenticado. A tabela será atualizada em segundo plano.');
      }
    } catch (err: any) {
      console.error('Erro ao definir nova senha:', err);
      setError(err.message || 'Erro ao definir nova senha.');
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {!success ? (
          <>
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={logoIconStyle}><Lock size={24} color="#fff" /></div>
              <h2 style={{ margin: '0.5rem 0' }}>Bem-vindo!</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Este é seu primeiro acesso. Cadastre uma senha para acessos futuros.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                />
              </div>

              {error && (
                <div style={{ marginTop: '1rem', color: 'var(--danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <AlertCircle /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1.25rem', width: '100%', height: 44 }}>
                {loading ? 'Salvando...' : 'Salvar Senha'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', color: 'var(--success)' }}><CheckCircle size={40} /></div>
            <h3>Nova senha salva com sucesso!</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Você será redirecionado para a página inicial em breve.</p>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{countdown}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'linear-gradient(135deg, #0B0C10 0%, #111218 50%, #0f0a1e 100%)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: '2rem',
  borderRadius: 12,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)'
};

const logoIconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 9999,
  background: 'rgba(59,130,246,0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto'
};
