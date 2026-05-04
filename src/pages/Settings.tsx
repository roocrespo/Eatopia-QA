import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2 } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState({
    id: '',
    provider: 'openai',
    api_key: '',
    modelo: 'gpt-4o',
    temperatura: 0.2,
    prompt: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data) {
        setConfig({
          id: data.id,
          provider: data.provider,
          api_key: data.api_key || '',
          modelo: data.modelo || '',
          temperatura: data.temperatura || 0.2,
          prompt: data.prompt || ''
        });
      }
    } catch (err: any) {
      console.error('Erro ao buscar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    try {
      const payload: any = {
        provider: config.provider,
        api_key: config.api_key,
        modelo: config.modelo,
        temperatura: config.temperatura,
        prompt: config.prompt
      };

      // Se já existir ID, atualiza. Senão, insere.
      if (config.id) {
        payload.id = config.id;
      }

      const { data, error } = await supabase
        .from('configuracoes')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setConfig(prev => ({ ...prev, id: data.id }));
        setMessage('Configurações salvas com sucesso!');
      }
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setMessage('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="flex-center">Carregando configurações...</div>;
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 className="page-title">Configurações de IA</h1>
      
      <div className="card">
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Provedor IA</label>
              <select 
                className="form-input" 
                value={config.provider}
                onChange={e => setConfig({...config, provider: e.target.value})}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>
            
            <div>
              <label className="form-label">Modelo</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: gpt-4o, claude-3-5-sonnet-20240620"
                value={config.modelo}
                onChange={e => setConfig({...config, modelo: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Sua chave de API..."
              value={config.api_key}
              onChange={e => setConfig({...config, api_key: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Temperatura ({config.temperatura})</label>
            <input 
              type="range" 
              min="0" max="1" step="0.1"
              style={{ width: '100%' }}
              value={config.temperatura}
              onChange={e => setConfig({...config, temperatura: parseFloat(e.target.value)})}
            />
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Temperaturas menores (ex: 0.2) geram análises mais consistentes e restritas.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Prompt Base de Análise</label>
            <textarea 
              className="form-input form-textarea" 
              style={{ minHeight: '300px' }}
              placeholder="Cole aqui o prompt e as regras fixas de análise..."
              value={config.prompt}
              onChange={e => setConfig({...config, prompt: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 className="spinner" size={16} /> : <Save size={16} />}
              Salvar Configurações
            </button>
            {message && <span style={{ color: message.includes('Erro') ? 'var(--danger)' : 'var(--success)', fontWeight: 500 }}>{message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
