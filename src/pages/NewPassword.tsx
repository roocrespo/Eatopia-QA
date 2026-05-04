import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Save, CheckCircle } from 'lucide-react';

export default function NewPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    let timer: number;
    if (success && countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (success && countdown === 0) {
      window.location.href = '/'; // Força um reload global para o Layout e toda a aplicação recarregar o banco corretamente
    }
    return () => clearInterval(timer);
  }, [success, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('O tempo limite foi atingido. Verifique sua conexão.');
      }
    }, 15000);

    try {
      console.log('Iniciando definição de nova senha...');
      // Atualiza a senha no Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({ password });
      
      if (authErr) throw authErr;
      
      console.log('Senha definida com sucesso no Auth.');
      // O trigger do lado do servidor cuidará de atualizar a tabela colaboradores.
      
      clearTimeout(timeout);
      setLoading(false);
      setSuccess(true);
    } catch (err: any) {
      clearTimeout(timeout);
      console.error('Erro ao definir senha:', err);
      setError(err.message || 'Erro ao definir senha.');
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <Lock size={30} />
        </div>
        
        {!success ? (
          <>
            <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Bem-vindo!</h2>
            <p style={{ marginBottom: '2rem', fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Este é seu primeiro acesso. Para sua segurança, cadastre uma senha para acessos futuros.
            </p>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Nova Senha</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1rem', height: '45px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                <Save size={20} />
                {loading ? 'Salvando...' : 'Salvar Senha'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <CheckCircle size={48} />
            </div>
            <h3 style={{ marginBottom: '1rem' }}>Nova senha salva com sucesso!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              A sua conta foi vinculada e está pronta para uso.
            </p>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              Redirecionando em {countdown}...
            </div>
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
  backgroundColor: 'var(--bg-primary)',
  padding: '2rem',
  color: 'var(--text-primary)',
};

const cardStyle: React.CSSProperties = {
  maxWidth: '400px',
  width: '100%',
  backgroundColor: 'var(--bg-secondary)',
  padding: '2.5rem 2rem',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid var(--border-color)',
};
