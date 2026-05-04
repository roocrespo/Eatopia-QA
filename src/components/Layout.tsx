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

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/analysis', label: 'Análise de Tickets', icon: <FileText size={20} /> },
    { path: '/team', label: 'Equipe', icon: <Users size={20} /> },
    { path: '/knowledge', label: 'Base de Conhecimento', icon: <BookOpen size={20} /> },
    { path: '/settings', label: 'Configurações IA', icon: <Settings size={20} /> },
  ];

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
