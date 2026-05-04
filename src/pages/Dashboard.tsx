import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Users, FileText, TrendingUp, Award, Target, Brain, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale/pt-BR';
import { generateTeamCoach, type TeamCoachResult } from '../lib/ai';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return [start, new Date()];
  });
  const [startDate, endDate] = dateRange;
  const [selectedUser, setSelectedUser] = useState('all');
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [currentUserColabId, setCurrentUserColabId] = useState<string | null>(null);
  const [isCollaborator, setIsCollaborator] = useState(false);

  const [metrics, setMetrics] = useState({
    totalAnalises: 0,
    mediaGeral: 0,
    totalTickets: 0,
    agenteDestaque: { nome: 'N/A', media: 0 }
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [recentes, setRecentes] = useState<any[]>([]);
  const [criteriosMedias, setCriteriosMedias] = useState<any[]>([]);
  const [latestCoach, setLatestCoach] = useState<any>(null);
  const [teamCoach, setTeamCoach] = useState<TeamCoachResult | null>(null);
  const [generatingTeamCoach, setGeneratingTeamCoach] = useState(false);
  const [agentPosition, setAgentPosition] = useState<number | null>(null);

  const criteriosDefinicoes: Record<string, string> = {
    "Abertura": "Utilizar a saudação padrão e se identificar corretamente em todos os atendimentos.",
    "Identificação": "Solicitar os dados necessários e identificar as informações iniciais do cliente.",
    "Empatia": "Demonstrar genuína preocupação com a solicitação ou falha apontada pelo cliente.",
    "Sondagem e Entendimento": "Coletar informações precisas para resolver o problema rapidamente.",
    "Palavras de Apoio": "Utilizar termos que tranquilizem o cliente durante o processo.",
    "Apresentação de Soluções": "Seguir estritamente o playbook ao oferecer a solução correta.",
    "Clareza no Acordo": "Explicar exatamente como o cliente deve proceder com as instruções.",
    "Orientação de Resgate": "Dar instrução clara e sem margem para dúvidas sobre uso de créditos.",
    "Gestão de Expectativas": "Pedir desculpas pela demora e reconhecer falhas, alinhando prazos.",
    "Tom de Voz e Profissionalismo": "Manter linguagem simples, humana e adequada a cada marca.",
    "Finalização": "Encerrar com cordialidade e convite para a pesquisa de satisfação.",
    "Tabulação e Registro": "Registrar internamente os detalhes para controle da operação."
  };

  // Carregar os colaboradores apenas uma vez
  useEffect(() => {
    async function fetchColabs() {
      const { data: { session } } = await supabase.auth.getSession();
      let colabId = null;
      if (session) {
        const { data: colabData } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        
        if (colabData) {
          colabId = colabData.id;
          setCurrentUserColabId(colabId);
          setIsCollaborator(true);
        }
      }

      const { data } = await supabase.from('colaboradores').select('id, nome');
      if (data) setColaboradores(data);
    }
    fetchColabs();
  }, []);

  // Recarregar os dados do dashboard sempre que os filtros mudarem
  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardData();
    }
  }, [startDate, endDate, selectedUser, colaboradores]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from('analises').select('*').order('created_at', { ascending: false });

      // Filtro de Data
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      // NÃO filtra por usuário ainda na query, pois precisamos do ranking global
      const { data: allAnalisesData, error: errAnalises } = await query;
      if (errAnalises) throw errAnalises;
      
      const allAnalises = allAnalisesData || [];
      
      const colabMap: Record<string, string> = {};
      colaboradores.forEach(c => colabMap[c.id] = c.nome);

      if (allAnalises.length === 0) {
        setMetrics({ totalAnalises: 0, mediaGeral: 0, totalTickets: 0, agenteDestaque: { nome: 'N/A', media: 0 } });
        setRanking([]);
        setChartData([]);
        setRecentes([]);
        setCriteriosMedias([]);
        setLatestCoach(null);
        setTeamCoach(null);
        setAgentPosition(null);
        setLoading(false);
        return;
      }

      // Pre-calcular o ranking global
      const statsPorColabGlobal: Record<string, { soma: number, count: number }> = {};
      allAnalises.forEach(a => {
        if (!statsPorColabGlobal[a.colaborador_id]) statsPorColabGlobal[a.colaborador_id] = { soma: 0, count: 0 };
        statsPorColabGlobal[a.colaborador_id].soma += a.nota_final;
        statsPorColabGlobal[a.colaborador_id].count += 1;
      });

      const rankingArray = Object.entries(statsPorColabGlobal).map(([id, stats]) => ({
        id,
        nome: colabMap[id] || 'Desconhecido',
        media: stats.soma / stats.count,
        total: stats.count
      })).sort((a, b) => b.media - a.media);

      const agenteDestaque = rankingArray.length > 0 ? rankingArray[0] : { nome: 'N/A', media: 0 };

      // Descobrir a posição do agente selecionado
      if (selectedUser !== 'all') {
        const pos = rankingArray.findIndex(r => r.id === selectedUser);
        setAgentPosition(pos !== -1 ? pos + 1 : null);
      } else {
        setAgentPosition(null);
      }

      // Agora filtramos as analises que serão usadas para as outras métricas
      const analises = selectedUser === 'all' ? allAnalises : allAnalises.filter(a => a.colaborador_id === selectedUser);

      if (analises.length === 0) {
        setMetrics({ totalAnalises: 0, mediaGeral: 0, totalTickets: 0, agenteDestaque });
        setRanking(rankingArray);
        setChartData([]);
        setRecentes([]);
        setCriteriosMedias([]);
        setLatestCoach(null);
        setTeamCoach(null);
        setLoading(false);
        return;
      }

      // 1. KPIs Basicos (usando as analises filtradas)
      const totalAnalises = analises.length;
      const totalTickets = analises.reduce((acc, curr) => acc + (curr.volume_conversas || 1), 0);
      const somaNotas = analises.reduce((acc, curr) => acc + (curr.nota_final || 0), 0);
      const mediaGeral = somaNotas / totalAnalises;

      // 3. Gráfico de Evolução (Agrupado por data)
      const dateMap: Record<string, { soma: number, count: number }> = {};
      analises.forEach(a => {
        const dateObj = new Date(a.created_at);
        const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        if (!dateMap[dateStr]) dateMap[dateStr] = { soma: 0, count: 0 };
        dateMap[dateStr].soma += a.nota_final;
        dateMap[dateStr].count += 1;
      });

      let chartArray = Object.keys(dateMap).map(date => ({
        data: date,
        nota: parseFloat((dateMap[date].soma / dateMap[date].count).toFixed(1))
      }));
      chartArray = chartArray.reverse().slice(-14); // Últimos 14 dias com análises

      // 4. Médias por Critério (As 12 Áreas)
      const critStats: Record<string, { soma: number, count: number, lastDesc: string }> = {};
      analises.forEach(a => {
        const json = a.resultado_json;
        if (json && json.criterios) {
          json.criterios.forEach((c: any) => {
            if (!critStats[c.nome]) critStats[c.nome] = { soma: 0, count: 0, lastDesc: '' };
            critStats[c.nome].soma += c.nota;
            critStats[c.nome].count += 1;
            // Pegar a justificativa mais recente (como analises estão em desc, a primeira que passar é a mais recente)
            if (!critStats[c.nome].lastDesc) {
              critStats[c.nome].lastDesc = c.justificativa || 'Média calculada para o período selecionado.';
            }
          });
        }
      });
      const criteriosArray = Object.entries(critStats).map(([nome, stats]) => ({
        nome,
        media: parseFloat((stats.soma / stats.count).toFixed(1)),
        desc: stats.lastDesc
      })).sort((a, b) => b.media - a.media); // Do melhor pro pior (ou inverso)

      // 5. Recentes e Latest Coach
      const recentesArray = analises.slice(0, 5).map(a => ({
        id: a.id,
        nome: colabMap[a.colaborador_id] || 'Desconhecido',
        nota: a.nota_final,
        data: new Date(a.created_at).toLocaleDateString('pt-BR'),
        marcas: a.marcas
      }));

      // Achar o coach mais recente
      let foundCoach = null;
      for (const a of analises) {
        if (a.resultado_json?.coach) {
          foundCoach = a.resultado_json.coach;
          break;
        }
      }

      setMetrics({ totalAnalises, mediaGeral, totalTickets, agenteDestaque });
      setRanking(rankingArray);
      setChartData(chartArray);
      setCriteriosMedias(criteriosArray);
      setRecentes(recentesArray);
      setLatestCoach(foundCoach);
      if (selectedUser !== 'all') {
        setTeamCoach(null);
      }

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTeamCoach = async () => {
    setGeneratingTeamCoach(true);
    try {
      const { data: config } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (!config) throw new Error('Configuração de IA não encontrada. Vá em Configurações.');
      
      const metricsText = `
      Média Geral da Equipe: ${metrics.mediaGeral}/5.0
      Ranking atual: ${ranking.map(r => `${r.nome}: ${r.media}`).join(', ')}
      Critérios e médias: ${criteriosMedias.map(c => `${c.nome}: ${c.media}/5.0`).join(', ')}
      `;

      const result = await generateTeamCoach(config, metricsText);
      setTeamCoach(result);
    } catch (err: any) {
      alert('Erro ao gerar Coach do Time: ' + err.message);
    } finally {
      setGeneratingTeamCoach(false);
    }
  };

  const getScoreColor = (nota: number) => {
    if (nota >= 4.5) return 'var(--success)';
    if (nota >= 3.5) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getScoreColorObj = (nota: number) => {
    if (nota >= 4.5) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: 'rgba(16, 185, 129, 0.2)' };
    if (nota >= 3.5) return { bg: 'rgba(234, 179, 8, 0.1)', text: '#EAB308', border: 'rgba(234, 179, 8, 0.2)' };
    return { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.2)' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0, border: 'none', padding: 0 }}>Dashboard Analítico</h1>
        
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Período</span>
              <DatePicker
                selectsRange={true}
                startDate={startDate || undefined}
                endDate={endDate || undefined}
                onChange={(update) => setDateRange(update)}
                locale={ptBR}
                dateFormat="dd/MM/yyyy"
                customInput={
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                    {startDate && endDate ? `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}` : 'Selecionar período...'}
                  </button>
                }
              />
            </div>
          </div>
          
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.25rem 0.5rem' }}>
              <Users size={16} color="var(--text-secondary)" />
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.875rem' }}
              >
                <option value="all">Todos os Agentes</option>
                {isCollaborator ? (
                  // Se for colaborador, só mostra ele mesmo além de "Todos"
                  colaboradores.filter(c => c.id === currentUserColabId).map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))
                ) : (
                  // Se for admin, mostra todos
                  colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <p>Carregando dados...</p>
        </div>
      ) : metrics.totalAnalises === 0 ? (
        <div className="card flex-center" style={{ minHeight: 300, flexDirection: 'column' }}>
          <Activity size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Nenhum dado encontrado</h3>
          <p>Não há análises para os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: 0 }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', padding: '1rem', borderRadius: '12px' }}>
                <Activity size={28} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>MÉDIA DO PERÍODO</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: getScoreColor(metrics.mediaGeral) }}>
                  {metrics.mediaGeral.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/5.0</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: 0 }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '12px' }}>
                <FileText size={28} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>TICKETS AVALIADOS</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {metrics.totalTickets}
                </div>
              </div>
            </div>

            {selectedUser === 'all' ? (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: 0 }}>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '1rem', borderRadius: '12px' }}>
                  <Award size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>DESTAQUE DO FILTRO</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {metrics.agenteDestaque.nome}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Média: {metrics.agenteDestaque.media.toFixed(1)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: 0 }}>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '1rem', borderRadius: '12px' }}>
                  <Award size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>POSIÇÃO NO RANKING</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {agentPosition ? `${agentPosition}º Lugar` : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No período selecionado
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Gráfico */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} color="var(--accent-color)" /> Evolução da Qualidade (Timeline)
              </h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 5]} stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--accent-color)', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="nota" stroke="var(--accent-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="var(--accent-color)" /> Ranking de Agentes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                {ranking.map((agente, index) => (
                  <div key={agente.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: index < ranking.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: index === 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-tertiary)', color: index === 0 ? 'var(--warning)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                        {index + 1}
                      </div>
                      <div>
                        <div style={{ 
                          fontWeight: 600, 
                          color: 'var(--text-primary)', 
                          fontSize: '0.9rem',
                          filter: isCollaborator && index > 1 && agente.id !== currentUserColabId ? 'blur(4px)' : 'none',
                          userSelect: isCollaborator && index > 1 && agente.id !== currentUserColabId ? 'none' : 'auto'
                        }}>
                          {agente.nome}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{agente.total} análises</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: getScoreColor(agente.media) }}>
                      {agente.media.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Desempenho por Critério Gráfico */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={20} color="var(--accent-color)" /> Média por Critério de Avaliação (Gráfico)
            </h3>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={criteriosMedias} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                  <XAxis type="number" domain={[0, 5]} stroke="var(--text-secondary)" />
                  <YAxis type="category" dataKey="nome" stroke="var(--text-primary)" fontSize={12} width={140} tick={{fill: 'var(--text-secondary)'}} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-tertiary)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                    {criteriosMedias.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.media >= 4.5 ? 'var(--success)' : entry.media >= 3.5 ? 'var(--warning)' : 'var(--danger)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


          {/* Cards de Critérios (Estilo Print 1) */}
          <div style={{ marginBottom: '3rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', letterSpacing: '0.05em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>CRITÉRIOS DE AVALIAÇÃO (MÉDIAS)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {criteriosMedias.map((c: any, i: number) => {
                const color = getScoreColorObj(c.media);
                return (
                  <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid ${color.border}`, borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome}</h4>
                      <span style={{ backgroundColor: color.bg, color: color.text, padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                        {c.media}/5
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                      {selectedUser === 'all' ? (
                        <>
                          <span style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5, display: 'block', marginBottom: '0.25rem' }}>O que esperamos: </span>
                          {criteriosDefinicoes[c.nome] || "Aplicar as diretrizes de qualidade padrão para este critério."}
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5, display: 'block', marginBottom: '0.25rem' }}>Última análise: </span>
                          {c.desc}
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Treinamento Direcionado */}
          {selectedUser === 'all' ? (
            <div style={{ marginBottom: '3rem', backgroundColor: 'var(--bg-secondary)', border: '2px solid #8B5CF6', borderRadius: 16, padding: '2rem', boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#8B5CF6' }}>
                  <span style={{ fontSize: '1.75rem' }}>🧠</span>
                  <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Treinamento Direcionado do Time (Coach CX)</h2>
                </div>
                {!teamCoach && (
                  <button 
                    onClick={handleGenerateTeamCoach} 
                    disabled={generatingTeamCoach} 
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#8B5CF6', border: 'none' }}
                  >
                    {generatingTeamCoach ? <Loader2 size={16} className="spinner" /> : <Brain size={16} />} 
                    Gerar com IA
                  </button>
                )}
              </div>
              
              {teamCoach ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Foco do Treino */}
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: '1.25rem' }}>🎯</span> Como time, onde devemos focar
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{teamCoach.foco}</p>
                  </div>

                  {/* O que esperamos */}
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: '#10B981' }}>
                      <span style={{ fontSize: '1.1rem' }}>✅</span> O que esperamos
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{teamCoach.esperamos}"</p>
                  </div>

                  {/* Desafio Prático */}
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: '1.25rem' }}>🏋️</span> Desafio prático
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{teamCoach.desafio}</p>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>Clique no botão acima para a Inteligência Artificial analisar o desempenho da equipe e gerar um plano de ação estratégico instantâneo.</p>
              )}
            </div>
          ) : (
            latestCoach && (
              <div style={{ marginBottom: '3rem', backgroundColor: 'var(--bg-secondary)', border: '2px solid #8B5CF6', borderRadius: 16, padding: '2rem', boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#8B5CF6' }}>
                  <span style={{ fontSize: '1.75rem' }}>🧠</span>
                  <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Treinamento Direcionado Mais Recente (Coach CX)</h2>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Foco do Treino */}
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: '1.25rem' }}>🎯</span> Foco do treino
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{latestCoach.foco}</p>
                  </div>

                  {/* Correção Prática */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, color: '#EF4444' }}>
                        <span style={{ fontSize: '1.1rem' }}>❌</span> Como foi feito:
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{latestCoach.correcao_erro}"</p>
                    </div>
                    
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, color: '#10B981' }}>
                        <span style={{ fontSize: '1.1rem' }}>✅</span> Como deveria ser:
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{latestCoach.correcao_acerto}"</p>
                    </div>
                  </div>

                  {/* Desafio Prático */}
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 12, padding: '1.5rem', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: '1.25rem' }}>🏋️</span> Desafio prático
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{latestCoach.desafio}</p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Recentes */}
          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Análises Recentes (Filtro Aplicado)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem 0', fontWeight: 600 }}>COLABORADOR</th>
                    <th style={{ padding: '1rem 0', fontWeight: 600 }}>DATA</th>
                    <th style={{ padding: '1rem 0', fontWeight: 600 }}>MARCA</th>
                    <th style={{ padding: '1rem 0', fontWeight: 600 }}>NOTA</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < recentes.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                      <td style={{ 
                        padding: '1rem 0', 
                        fontWeight: 500, 
                        color: 'var(--text-primary)',
                        filter: isCollaborator && r.nome !== colaboradores.find(c => c.id === currentUserColabId)?.nome && ranking.findIndex(rk => rk.nome === r.nome) > 1 ? 'blur(4px)' : 'none',
                        userSelect: isCollaborator && r.nome !== colaboradores.find(c => c.id === currentUserColabId)?.nome && ranking.findIndex(rk => rk.nome === r.nome) > 1 ? 'none' : 'auto'
                      }}>
                        {r.nome}
                      </td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.data}</td>
                      <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{r.marcas || '-'}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{ backgroundColor: r.nota >= 4 ? 'rgba(16, 185, 129, 0.1)' : r.nota >= 3 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: getScoreColor(r.nota), padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
                          {r.nota.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
