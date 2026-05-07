import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Performance from './pages/Performance';
import Encantamento from './pages/Encantamento';
import Team from './pages/Team';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NewPassword from './pages/NewPassword';

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    let subscription: any = null;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        if (!mounted) return;

        if (session) {
          try {
            const { data: colab } = await supabase.from('colaboradores').select('id').eq('user_id', session.user.id).single();
            if (!mounted) return;
            setSession({ ...session, isCollaborator: !!colab } as any);
          } catch (err) {
            console.error('Error fetching collaborator on init:', err);
            if (mounted) setSession({ ...session, isCollaborator: false } as any);
          }
        } else {
          if (mounted) setSession(null);
        }

        // subscribe to auth changes
        const sub = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          try {
            if (!mounted) return;
            if (newSession) {
              const { data: colab } = await supabase.from('colaboradores').select('id').eq('user_id', newSession.user.id).single();
              if (!mounted) return;
              setSession({ ...newSession, isCollaborator: !!colab } as any);
            } else {
              if (mounted) setSession(null);
            }
          } catch (err) {
            console.error('Error in onAuthStateChange handler:', err);
          }
        });

        subscription = (sub as any)?.data?.subscription ?? (sub as any)?.subscription ?? null;
      } catch (err) {
        console.error('Auth init error:', err);
        if (mounted) setSession(null);
      }
    };

    init();

    return () => {
      mounted = false;
      try { subscription?.unsubscribe?.(); } catch (e) { /* ignore */ }
    };
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
        <Route
          path="/new-password"
          element={session ? <NewPassword /> : <Navigate to="/login" replace />}
        />

        {/* Rotas protegidas (Inicial, colaboradores, Analise de tickets, base de conhecimento, Configurações de iA) */}
        <Route
          path="/"
          element={session ? <Layout /> : <Navigate to="/login" replace />}
        >
          {/* Inicial / Dashboard */}
          <Route index element={<Dashboard />} />
          
          {/* Rotas restritas para administradores */}
          {!(session as any)?.isCollaborator ? (
            <>
              {/* Analise de tickets */}
              <Route path="analysis" element={<Analysis />} />
              {/* Desempenho */}
              <Route path="performance" element={<Performance />} />
              {/* colaboradores / Equipe */}
              <Route path="team" element={<Team />} />
              {/* base de conhecimento */}
              <Route path="knowledge" element={<KnowledgeBase />} />
              {/* Configurações de iA */}
              <Route path="settings" element={<Settings />} />
              <Route path="encantamento" element={<Encantamento />} />
            </>
          ) : (
            <>
              {/* Se for colaborador, redirecionar tentativas de acesso a rotas admin para a home */}
              <Route path="analysis" element={<Navigate to="/" replace />} />
              <Route path="performance" element={<Navigate to="/" replace />} />
              <Route path="team" element={<Navigate to="/" replace />} />
              <Route path="knowledge" element={<Navigate to="/" replace />} />
              <Route path="settings" element={<Navigate to="/" replace />} />
              <Route path="encantamento" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>

        {/* Fallback para qualquer outra rota */}
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
