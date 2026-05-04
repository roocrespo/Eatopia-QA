import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeTickets, type AnalysisResult } from '../lib/ai';
import { Plus, Trash2, Play, Loader2, FileText, CheckCircle, AlertCircle, TrendingUp, Brain, Printer } from 'lucide-react';

interface Colaborador {
  id: string;
  nome: string;
}

export default function Analysis() {
  const [conversas, setConversas] = useState<{texto: string, data: string}[]>([{texto: '', data: new Date().toISOString().split('T')[0]}]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [selectedColab, setSelectedColab] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const fetchColaboradores = async () => {
    const { data } = await supabase.from('colaboradores').select('id, nome').eq('status', 'ativo');
    if (data) {
      setColaboradores(data);
      if (data.length > 0) setSelectedColab(data[0].id);
    }
  };

  const addConversa = () => setConversas([...conversas, {texto: '', data: new Date().toISOString().split('T')[0]}]);
  
  const removeConversa = (index: number) => {
    if (conversas.length === 1) return;
    setConversas(conversas.filter((_, i) => i !== index));
  };

  const updateConversaTexto = (index: number, text: string) => {
    const newConversas = [...conversas];
    newConversas[index].texto = text;
    setConversas(newConversas);
  };

  const updateConversaData = (index: number, data: string) => {
    const newConversas = [...conversas];
    newConversas[index].data = data;
    setConversas(newConversas);
  };

  const handleAnalyze = async () => {
    if (!selectedColab) {
      alert('Por favor, selecione (ou cadastre) um colaborador primeiro.');
      return;
    }
    
    const conversasValidas = conversas.filter(c => c.texto.trim().length > 0);
    if (conversasValidas.length === 0) {
      alert('Cole pelo menos uma conversa para analisar.');
      return;
    }
    
    // Formatar enviando a data como contexto
    const textosValidos = conversasValidas.map(c => {
      const dataFormatada = new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR');
      return `[Data da Conversa: ${dataFormatada}]\n${c.texto}`;
    });

    setAnalyzing(true);
    setResultado(null);

    try {
      // 1. Fetch config
      const { data: config } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (!config || !config.api_key) {
        throw new Error('Configuração de IA não encontrada ou API Key faltando. Vá na aba de Configurações.');
      }

      // 2. Buscar playbook da Base de Conhecimento (conteúdo texto dos arquivos .txt)
      let playbookContent = '';
      const { data: playbooks } = await supabase
        .from('base_conhecimento')
        .select('nome_arquivo, conteudo_texto')
        .not('conteudo_texto', 'is', null);
      
      if (playbooks && playbooks.length > 0) {
        playbookContent = playbooks
          .map(p => `[${p.nome_arquivo}]\n${p.conteudo_texto}`)
          .join('\n\n');
      }

      // 3. Call AI API com playbook injetado
      const result: AnalysisResult = await analyzeTickets(config, textosValidos, playbookContent);
      setResultado(result);

      // Pegar a data da conversa mais recente para definir a "data de referência" da análise
      // Isso ajuda se o usuário analisar tickets passados. Se não houver, usa a data atual.
      const datas = conversasValidas.map(c => new Date(c.data + 'T12:00:00').getTime());
      const dataReferencia = new Date(Math.max(...datas));

      // 3. Salvar no banco
      const { data: analise, error: errAnalise } = await supabase.from('analises').insert({
        colaborador_id: selectedColab,
        nota_final: result.nota_final,
        volume_conversas: textosValidos.length,
        marcas: (result.marcas || []).join(', '),
        resultado_json: result,
        created_at: dataReferencia.toISOString() // Sobrescreve a data de criação para a data do ticket mais recente avaliado
      }).select().single();

      if (errAnalise) throw new Error('Erro ao salvar análise: ' + errAnalise.message);

      if (result.criterios && result.criterios.length > 0) {
        const criteriosPayload = result.criterios.map(c => ({
          analise_id: analise.id,
          nome_criterio: c.nome,
          nota: c.nota,
          justificativa: c.justificativa,
          exemplo: c.exemplo
        }));

        const { error: errCriterios } = await supabase.from('criterios').insert(criteriosPayload);
        if (errCriterios) throw new Error('Erro ao salvar critérios: ' + errCriterios.message);
      }

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao realizar análise.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (resultado) {
    const colabName = colaboradores.find(c => c.id === selectedColab)?.nome || 'Desconhecido';
    
    const getScoreColor = (nota: number) => {
      if (nota >= 4.5) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: 'rgba(16, 185, 129, 0.2)' };
      if (nota >= 3) return { bg: 'rgba(234, 179, 8, 0.1)', text: '#EAB308', border: 'rgba(234, 179, 8, 0.2)' };
      return { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.2)' };
    };

    const getScoreLabel = (nota: number) => {
      if (nota >= 4.5) return 'Excelente';
      if (nota >= 3.5) return 'Satisfatório';
      return 'Precisa Melhorar';
    };

    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 24, padding: '3rem', fontFamily: 'Inter, sans-serif', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="print-hide" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => setResultado(null)}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              ← Voltar para Nova Análise
            </button>
            <button 
              onClick={() => window.print()}
              style={{ background: 'var(--accent-color)', border: 'none', color: '#FFF', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}
            >
              <Printer size={18} />
              Imprimir / Salvar PDF
            </button>
          </div>

          <div style={{ display: 'inline-block', border: '1px solid var(--border-color)', borderRadius: 20, padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Qualidade de Atendimento
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 2rem 0', color: 'var(--text-primary)' }}>
            Relatório de QA <span style={{ background: 'linear-gradient(90deg, #9F7AEA 0%, #F472B6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EATOPIA</span>
          </h1>

          <div style={{ display: 'flex', gap: '3rem', marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>COLABORADOR</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{colabName}</div>
            </div>
            <div style={{ width: 1, backgroundColor: 'var(--border-color)' }}></div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>MARCA</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{resultado.marcas?.join(', ') || 'N/A'}</div>
            </div>
            <div style={{ width: 1, backgroundColor: 'var(--border-color)' }}></div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>CANAL</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>Zendesk</div>
            </div>
          </div>

          {/* Desempenho Geral */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ maxWidth: '60%' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Desempenho Geral</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>Avaliação baseada nos critérios técnicos e comportamentais fundamentais para a excelência no atendimento ao cliente.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                  <circle 
                    cx="60" cy="60" r="54" fill="none" stroke={getScoreColor(resultado.nota_final).text} strokeWidth="8" 
                    strokeDasharray="339.29" strokeDashoffset={339.29 - (339.29 * (resultado.nota_final / 5))}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{resultado.nota_final.toFixed(1)}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>DE 5.0</span>
                </div>
              </div>
              <div style={{ background: getScoreColor(resultado.nota_final).bg, color: getScoreColor(resultado.nota_final).text, padding: '0.25rem 1rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                {getScoreLabel(resultado.nota_final)}
              </div>
            </div>
          </div>

          {/* Diagnóstico Geral */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', padding: '0.5rem', borderRadius: 8 }}>
                <CheckCircle size={20} />
              </div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>Diagnóstico Geral</h2>
            </div>
            <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: '1rem', margin: '0 0 1.5rem 0' }}>
              {resultado.diagnostico}
            </p>
            {resultado.pontos_fortes && resultado.pontos_fortes.length > 0 && (
               <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1.25rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                 "{resultado.pontos_fortes[0]}"
               </div>
            )}
          </div>

          {/* Erros e Sugestões */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#EF4444' }}>
                <AlertCircle size={18} />
                <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>PRINCIPAIS ERROS</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {resultado.erros?.map((e: string, i: number) => {
                  const parts = e.split(':');
                  const isTitleDesc = parts.length > 1 && parts[0].length < 40;
                  return (
                    <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: '1.25rem' }}>
                      {isTitleDesc ? (
                        <>
                          <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>{parts[0]}</h4>
                          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{parts.slice(1).join(':').trim()}</p>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{e}</p>
                      )}
                    </div>
                  );
                })}
                {(!resultado.erros || resultado.erros.length === 0) && (
                  <p style={{ color: 'var(--text-secondary)' }}>Nenhum erro grave identificado.</p>
                )}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#10B981' }}>
                <TrendingUp size={18} />
                <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>SUGESTÕES DE MELHORIA</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {resultado.sugestoes?.map((s: string, i: number) => {
                  const parts = s.split(':');
                  const isTitleDesc = parts.length > 1 && parts[0].length < 40;
                  return (
                    <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: '1.25rem' }}>
                      {isTitleDesc ? (
                        <>
                          <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>{parts[0]}</h4>
                          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{parts.slice(1).join(':').trim()}</p>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{s}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Critérios */}
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>CRITÉRIOS DE AVALIAÇÃO</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {resultado.criterios?.map((c: any, i: number) => {
                const color = getScoreColor(c.nota);
                return (
                  <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid ${color.border}`, borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome}</h4>
                      <span style={{ backgroundColor: color.bg, color: color.text, padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                        {c.nota}/5
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>{c.justificativa}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Treinamento Direcionado */}
          {resultado.coach && (
            <div style={{ marginTop: '3rem', backgroundColor: 'var(--bg-secondary)', border: '2px solid #8B5CF6', borderRadius: 16, padding: '2rem', boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#8B5CF6' }}>
                <Brain size={28} />
                <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Treinamento Direcionado (Coach CX)</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Foco do Treino */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #8B5CF6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '1.25rem' }}>🎯</span> Foco do treino
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{resultado.coach.foco}</p>
                </div>

                {/* Correção Prática */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, color: '#EF4444' }}>
                      <span style={{ fontSize: '1.1rem' }}>❌</span> Como foi feito:
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{resultado.coach.correcao_erro}"</p>
                  </div>
                  
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, color: '#10B981' }}>
                      <span style={{ fontSize: '1.1rem' }}>✅</span> Como deveria ser:
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{resultado.coach.correcao_acerto}"</p>
                  </div>
                </div>

                {/* Desafio Prático */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '1.25rem' }}>🏋️</span> Desafio prático
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{resultado.coach.desafio}</p>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Nova Análise de QA</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Esquerda: Inputs */}
        <div>
          <div className="card">
            <div className="form-group">
              <label className="form-label">Colaborador Avaliado</label>
              <select 
                className="form-input" 
                value={selectedColab} 
                onChange={e => setSelectedColab(e.target.value)}
              >
                <option value="" disabled>Selecione um colaborador...</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Conversas do Zendesk</h3>
                <button type="button" className="btn btn-secondary" onClick={addConversa}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>

              {conversas.map((item, index) => (
                <div key={index} style={{ marginBottom: '1.5rem', position: 'relative', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Data da Conversa</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ padding: '0.5rem', width: '200px' }}
                        value={item.data}
                        onChange={e => updateConversaData(index, e.target.value)}
                      />
                    </div>

                    {conversas.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeConversa(index)}
                        style={{ 
                          background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem'
                        }}
                        title="Remover conversa"
                      >
                        <Trash2 size={16} /> <span style={{ fontSize: '0.85rem' }}>Remover</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    className="form-input form-textarea"
                    placeholder={`Cole aqui o texto do ticket ${index + 1}...`}
                    value={item.texto}
                    onChange={e => updateConversaTexto(index, e.target.value)}
                    style={{ minHeight: '150px' }}
                  />
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? <Loader2 className="spinner" size={18} /> : <Play size={18} />}
              {analyzing ? 'Analisando com IA...' : 'Analisar Tickets'}
            </button>
          </div>
        </div>

        {/* Direita: Resultados (Placeholder apenas) */}
        <div>
          <div className="card flex-center" style={{ minHeight: '300px', flexDirection: 'column', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Os resultados da análise aparecerão em uma nova tela.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
