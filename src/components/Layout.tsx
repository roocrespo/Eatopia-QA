import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BookOpen, Settings, Moon, Sun, ChevronLeft, ChevronRight, LogOut, User, Lock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{id: string, name: string, email: string, senha_definida?: boolean} | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const email = session.user.email || '';
        let name = session.user.user_metadata?.full_name || email.split('@')[0];

        const { data } = await supabase
          .from('colaboradores')
          .select('id, nome, senha_definida')
          .eq('user_id', session.user.id)
          .single();
        
        if (data) {
          setIsCollaborator(true);
          setIsDarkMode(true);
          name = data.nome;
          
          if (data.senha_definida === false) {
            // mostra apenas um popup informativo pedindo para definir a senha via Perfil
            setShowWelcomePopup(true);
          }
        }

        setUserData({ id: session.user.id, name, email, senha_definida: data?.senha_definida });
      }
      setLoading(false);
    }
    checkRole();
  }, []);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = isCollaborator 
    ? [{ path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> }]
    : [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/analysis', label: 'Análise de Tickets', icon: <FileText size={20} /> },
        { path: '/team', label: 'Equipe', icon: <Users size={20} /> },
        { path: '/knowledge', label: 'Base de Conhecimento', icon: <BookOpen size={20} /> },
        { path: '/settings', label: 'Configurações IA', icon: <Settings size={20} /> },
      ];

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="app-container">
      <aside className="sidebar" style={{ ...sidebarStyle, width: isCollapsed ? '80px' : 'var(--sidebar-width)', transition: 'width 0.3s ease' }}>
        <div style={{ ...logoContainerStyle, justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '0' : '0 1.5rem' }}>
          {!isCollapsed && <h2>Eatopia QA</h2>}
          <button onClick={toggleSidebar} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav style={navStyle}>
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              title={isCollapsed ? item.label : undefined}
              style={{
                ...navItemStyle, 
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem',
                backgroundColor: location.pathname === item.path ? 'var(--bg-primary)' : 'transparent',
                color: location.pathname === item.path ? 'var(--accent-color)' : 'var(--text-secondary)'
              }}
            >
              {item.icon}
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div style={{ padding: isCollapsed ? '1.5rem 0' : '1.5rem 1rem', marginTop: 'auto', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
          {userData && !isCollapsed && (
            <div 
              onClick={() => setShowProfile(true)}
              style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem', cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'background 0.2s' }}
              className="user-profile-hover"
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userData.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userData.email}
              </div>
            </div>
          )}
          
          {userData && isCollapsed && (
            <div 
              onClick={() => setShowProfile(true)}
              title={`${userData.name} (${userData.email})`}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {userData.name.charAt(0).toUpperCase()}
            </div>
          )}

          <button 
            onClick={toggleDarkMode} 
            title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            style={{ ...navItemStyle, width: '100%', justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {!isCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          
          <button 
            onClick={handleLogout} 
            title="Sair"
            style={{ ...navItemStyle, width: '100%', justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>

      {/* Profile Modal */}
      {showProfile && (
        <div style={modalOverlayStyle} onClick={() => setShowProfile(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '90%', padding: '2rem', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowProfile(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={24} color="var(--accent-color)" /> Minha Conta
            </h2>
            

            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} /> Alterar Senha
            </h3>
            
            {/* Se o usuário não definiu senha, mostramos apenas o campo de nova senha */}
            {userData?.senha_definida === false ? (
              <NewPasswordProfileForm onSuccess={() => setShowProfile(false)} />
            ) : (
              <ChangePasswordForm onSuccess={() => setShowProfile(false)} />
            )}
          </div>
        </div>
      )}

      {/* Welcome popup shown on first access (dismissible) */}
      {showWelcomePopup && (
        <div style={welcomeOverlayStyle} onClick={() => setShowWelcomePopup(false)}>
          <div style={welcomeCardStyle} onClick={e => e.stopPropagation()}>
            <h2>Bem-vindo ao Eatopia QA</h2>
            <p>Obrigado por acessar o sistema, {userData?.name}.</p>
            <p style={{ marginTop: '0.5rem' }}>Como é seu primeiro acesso, é importante que crie uma senha. Abra o menu e clique em Minha Conta → Definir Senha.</p>
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setShowWelcomePopup(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMsg(null);
    console.log('ChangePasswordForm: iniciando atualização de senha...');
    try {
      // Nota: Supabase exige reautenticação ou senha atual para trocar senha se configurado.
      // Se o usuário não tem senha (magic link), ele deve usar o onboarding.
      // Aqui usamos a senha atual para trocar.

       // 🔥 PASSO CRÍTICO
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }
     console.log('Sessão OK, atualizando senha...');

     // 🔥 força sessão atualizada
await supabase.auth.refreshSession();

const { error } = await supabase.auth.updateUser({
  password: newPassword
});

if (error) throw error;

      console.log('ChangePasswordForm: senha atualizada com sucesso no Auth.');
     setMsg({ type: 'success', text: 'Senha atualizada com sucesso!' });

// espera 300ms pra UX melhor + evitar race condition
setTimeout(() => {
  setCurrentPassword('');
  setNewPassword('');
  onSuccess?.();
}, 300);
    } catch (err: any) {
      console.error('ERRO REAL', err);
      setMsg({ type: 'error', text: err.message || 'Erro ao atualizar senha.' });
    } finally {
      console.log("finalizando fluxo");
      setLoading(false);
    }
    
  };

  return (
    <form onSubmit={handleUpdate}>
      <div className="form-group">
        <label className="form-label">Senha Atual</label>
        <input 
          type="password" 
          className="form-input" 
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Nova Senha</label>
        <input 
          type="password" 
          className="form-input" 
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
        />
      </div>
      {msg && <p style={{ color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>{msg.text}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '45px' }}>
        {loading ? 'Atualizando...' : 'Salvar Nova Senha'}
      </button>
    </form>
  );
}

function NewPasswordProfileForm({ onSuccess }: { onSuccess?: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('NewPasswordProfileForm: iniciando definição de senha...');
    try {
      // garante sessão
      const { data: sessionResp } = await supabase.auth.getSession();
      const user = sessionResp?.session?.user;
      if (!user) throw new Error('Sessão inválida. Faça login novamente.');

      const { error: authErr } = await supabase.auth.updateUser({ password });
      if (authErr) throw authErr;
      console.log('NewPasswordProfileForm: senha atualizada no Auth.');

      // tentamos também garantir no colaboradores se possível (fallback)
      try {
        const { error: updErr } = await supabase.from('colaboradores').update({ senha_definida: true, status_convite: 'vinculado' }).eq('user_id', user.id);
        if (updErr) console.warn('NewPasswordProfileForm: fallback update error:', updErr);
        else console.log('NewPasswordProfileForm: fallback update success');
      } catch (e) {
        console.warn('NewPasswordProfileForm: fallback update threw', e);
      }

      // reset field
      setPassword('');
      // fechar modal
      if (onSuccess) {
        try { onSuccess(); } catch (e) { console.warn('onSuccess threw', e); }
      }
    } catch (err: any) {
      console.error('NewPasswordProfileForm error:', err);
      setError(err.message || 'Erro ao definir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Nova Senha</label>
        <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)'
};

const sidebarStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  borderRight: '1px solid var(--border-color)',
  display: 'flex',
  flexDirection: 'column',
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto'
};

const welcomeOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const welcomeCardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 520,
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)'
};

const logoContainerStyle: React.CSSProperties = {
  minHeight: 'var(--header-height)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 1.5rem',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--accent-color)'
};

const navStyle: React.CSSProperties = {
  padding: '1.5rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-md)',
  textDecoration: 'none',
  fontWeight: 500,
  transition: 'all 0.2s'
};
