import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BookOpen, Settings, Moon, Sun, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
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
  const [userData, setUserData] = useState<{name: string, email: string} | null>(null);

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
          .select('id, nome')
          .eq('user_id', session.user.id)
          .single();
        
        if (data) {
          setIsCollaborator(true);
          setIsDarkMode(true); // Forçar modo escuro para colaboradores
          name = data.nome;
        }

        setUserData({ name, email });
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

  if (loading) return null;

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
            <div style={{ padding: '0 0.5rem 1rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
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
              title={`${userData.name} (${userData.email})`}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1rem', fontWeight: 700 }}
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
    </div>
  );
}

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
