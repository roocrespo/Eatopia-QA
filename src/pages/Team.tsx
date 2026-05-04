import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Mail, Send, CheckCircle, Loader2 } from 'lucide-react';

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  status: string;
  status_convite: string;
  ultimo_acesso: string | null;
}

export default function Team() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentColab, setCurrentColab] = useState<{id?: string, nome: string, email: string, status: string}>({
    nome: '', email: '', status: 'ativo'
  });
  const [inviting, setInviting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const fetchColaboradores = async () => {
    const { data } = await supabase.from('colaboradores').select('*').order('nome');
    if (data) setColaboradores(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentColab.id) {
      await supabase.from('colaboradores').update({
        nome: currentColab.nome,
        email: currentColab.email,
        status: currentColab.status
      }).eq('id', currentColab.id);
    } else {
      await supabase.from('colaboradores').insert({
        nome: currentColab.nome,
        email: currentColab.email,
        status: currentColab.status
      });
    }
    setIsModalOpen(false);
    fetchColaboradores();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      await supabase.from('colaboradores').delete().eq('id', id);
      fetchColaboradores();
    }
  };

  const handleInvite = async (colab: Colaborador) => {
    if (!colab.email) {
      setErrorMsg('O colaborador precisa ter um e-mail cadastrado para ser convidado.');
      return;
    }

    setInviting(colab.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Usamos signInWithOtp para "Convidar":
      // 1. Envia um link de acesso por e-mail.
      // 2. Se o usuário não existir no Auth, o Supabase cria automaticamente.
      // 3. O trigger no banco (que eu criei) vincula o user_id ao colaborador via e-mail.
      const { error } = await supabase.auth.signInWithOtp({
        email: colab.email,
        options: {
          emailRedirectTo: `${window.location.origin}/reset-password`,
        }
      });

      if (error) throw error;

      // Atualiza o status localmente para 'enviado'
      await supabase.from('colaboradores').update({ status_convite: 'enviado' }).eq('id', colab.id);
      
      setSuccessMsg(`Convite enviado para ${colab.email}!`);
      fetchColaboradores(); // Recarrega para mostrar o status novo
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Erro ao convidar:', err);
      setErrorMsg('Erro ao enviar convite: ' + (err.message || 'Verifique se o e-mail é válido.'));
    } finally {
      setInviting(null);
    }
  };

  const openNew = () => {
    setCurrentColab({ nome: '', email: '', status: 'ativo' });
    setIsModalOpen(true);
  };

  const openEdit = (c: Colaborador) => {
    setCurrentColab(c);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0, border: 'none', padding: 0 }}>Equipe (QA)</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Novo Colaborador
        </button>
      </div>

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', marginBottom: '1.5rem', color: '#10B981' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', marginBottom: '1.5rem', color: '#EF4444' }}>
          <Mail size={18} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex-center" style={{ padding: '2rem' }}>Carregando...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Nome</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Convite</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Último Acesso</th>
                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum colaborador cadastrado.
                  </td>
                </tr>
              ) : (
                colaboradores.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{c.nome}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem',
                        color: c.status_convite === 'vinculado' ? 'var(--success)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {c.status_convite === 'vinculado' ? '✅ Ativado' : 
                         c.status_convite === 'enviado' ? '📩 Enviado' : '⏳ Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '1rem', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        backgroundColor: c.status === 'ativo' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: c.status === 'ativo' ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }} 
                          onClick={() => handleInvite(c)}
                          disabled={inviting === c.id}
                          title="Enviar convite por e-mail"
                        >
                          {inviting === c.id ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
                          Convidar
                        </button>
                        <button 
                          className="btn" 
                          style={{ padding: '0.5rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center' }} 
                          onClick={() => openEdit(c)}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn" 
                          style={{ padding: '0.5rem', color: 'var(--danger)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center' }} 
                          onClick={() => handleDelete(c.id)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '400px', margin: 0 }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{currentColab.id ? 'Editar' : 'Novo'} Colaborador</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input required type="text" className="form-input" value={currentColab.nome} onChange={e => setCurrentColab({...currentColab, nome: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={currentColab.email} onChange={e => setCurrentColab({...currentColab, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={currentColab.status} onChange={e => setCurrentColab({...currentColab, status: e.target.value})}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
