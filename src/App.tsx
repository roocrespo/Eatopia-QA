import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Team from './pages/Team';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Verificar sessão atual ao montar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: colab } = await supabase.from('colaboradores').select('id').eq('user_id', session.user.id).single();
        setSession({ ...session, isCollaborator: !!colab } as any);
      } else {
        setSession(null);
      }
    });

    // Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: colab } = await supabase.from('colaboradores').select('id').eq('user_id', session.user.id).single();
        setSession({ ...session, isCollaborator: !!colab } as any);
      } else {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enquanto verifica a sessão, mostra tela de loading
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0B0C10 0%, #111218 50%, #0f0a1e 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid rgba(139, 92, 246, 0.3)',
            borderTopColor: '#8B5CF6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '0.9rem' }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/forgot-password"
          element={session ? <Navigate to="/" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* Rotas protegidas */}
        <Route
          path="/"
          element={session ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          
          {/* Rotas restritas para administradores */}
          {!(session as any)?.isCollaborator && (
            <>
              <Route path="analysis" element={<Analysis />} />
              <Route path="team" element={<Team />} />
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="settings" element={<Settings />} />
            </>
          )}
          
          {/* Redirecionar colaboradores se tentarem acessar rotas restritas via URL */}
          {(session as any)?.isCollaborator && (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
