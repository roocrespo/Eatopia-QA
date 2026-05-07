import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Users, FileText, TrendingUp, Award, Target, Brain, Loader2, MessageCircle, Phone, Clock, Star, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, Legend } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale/pt-BR';
import { generateTeamCoach, type TeamCoachResult } from '../lib/ai';

const timeToSeconds = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
};

const secondsToTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0 || seconds === Infinity) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

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

  // Quality metrics
  const [metrics, setMetrics] = useState({
    totalAnalises: 0,
    mediaGeral: 0,
    totalTickets: 0,
    agenteDestaque: { nome: 'N/A', media: 0 }
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [criteriosMedias, setCriteriosMedias] = useState<any[]>([]);
  const [latestCoach, setLatestCoach] = useState<any>(null);
  const [teamCoach, setTeamCoach] = useState<TeamCoachResult | null>(null);
  const [generatingTeamCoach, setGeneratingTeamCoach] = useState(false);
  const [agentPosition, setAgentPosition] = useState<number | null>(null);

  // Operational metrics
  const [opMetrics, setOpMetrics] = useState({
    totalTickets: 0,
    canais: { whatsapp: 0, instagram: 0, telefone: 0 },
    csat: { bom: 0, ruim: 0, injusto: 0, nao_avaliado: 0 },
    tmWppSeconds: 0,
    tmInstaSeconds: 0,
    avgSeconds: 0,
    ligacoes: { atendidas: 0, nao_atendidas: 0, total: 0 }
  });

  const [destaques, setDestaques] = useState({
    csat: { nome: 'N/A', val: 0 },
    tickets: { nome: 'N/A', val: 0 },
    ligacoes: { nome: 'N/A', val: 0 },
    tmWpp: { nome: 'N/A', val: Infinity },
    tmInsta: { nome: 'N/A', val: Infinity },
    avg: { nome: 'N/A', val: Infinity }
  });

  const [opCharts, setOpCharts] = useState<any[]>([]);

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

  useEffect(() => {
    if (startDate && endDate && colaboradores.length > 0) {
      fetchDashboardData();
    }
  }, [startDate, endDate, selectedUser, colaboradores]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const colabMap: Record<string, string> = {};
      colaboradores.forEach(c => colabMap[c.id] = c.nome);

      // --- 1. QUALIDADE (analises) ---
      let queryAnalises = supabase.from('analises').select('*').order('created_at', { ascending: false });

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryAnalises = queryAnalises.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data: allAnalisesData, error: errAnalises } = await queryAnalises;
      if (errAnalises) throw errAnalises;
      
      const allAnalises = allAnalisesData || [];

      // Pre-calcular ranking global de qualidade
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

      if (selectedUser !== 'all') {
        const pos = rankingArray.findIndex(r => r.id === selectedUser);
        setAgentPosition(pos !== -1 ? pos + 1 : null);
      } else {
        setAgentPosition(null);
      }

      const analises = selectedUser === 'all' ? allAnalises : allAnalises.filter(a => a.colaborador_id === selectedUser);
      
      const totalAnalises = analises.length;
      const mediaGeral = totalAnalises > 0 ? analises.reduce((acc, curr) => acc + (curr.nota_final || 0), 0) / totalAnalises : 0;

      // Quality chart
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
      chartArray = chartArray.reverse().slice(-14);

      // Quality criterias
      const critStats: Record<string, { soma: number, count: number, lastDesc: string }> = {};
      analises.forEach(a => {
        const json = a.resultado_json;
        if (json && json.criterios) {
          json.criterios.forEach((c: any) => {
            if (!critStats[c.nome]) critStats[c.nome] = { soma: 0, count: 0, lastDesc: '' };
            critStats[c.nome].soma += c.nota;
            critStats[c.nome].count += 1;
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
      })).sort((a, b) => b.media - a.media);

      let foundCoach = null;
      for (const a of analises) {
        if (a.resultado_json?.coach) {
          foundCoach = a.resultado_json.coach;
          break;
        }
      }

      setMetrics({ totalAnalises, mediaGeral, totalTickets: 0, agenteDestaque });
      setRanking(rankingArray);
      setChartData(chartArray);
      setCriteriosMedias(criteriosArray);
      setLatestCoach(foundCoach);
      if (selectedUser !== 'all') setTeamCoach(null);


      // --- 2. OPERACIONAL (performance_zendesk) ---
      let perfQuery = supabase.from('performance_zendesk').select('*');
      if (startDate && endDate) {
        // Adjust for timezone issues simply by formatting as YYYY-MM-DD
        const dStart = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
        const dEnd = `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`;
        perfQuery = perfQuery.gte('data_inicio', dStart).lte('data_inicio', dEnd); 
        // We use data_inicio as the reference point for the filter
      }

      const { data: allPerfDataRes, error: errPerf } = await perfQuery;
      if (errPerf) throw errPerf;
      
      const allPerfData = allPerfDataRes || [];
      const perfData = selectedUser === 'all' ? allPerfData : allPerfData.filter(p => p.user_id === selectedUser);

      const resumo = {
        totalTickets: 0,
        canais: { whatsapp: 0, instagram: 0, telefone: 0 },
        csat: { bom: 0, ruim: 0, injusto: 0, nao_avaliado: 0 },
        tm: { whatsapp: 0, instagram: 0, countWpp: 0, countInsta: 0 },
        ligacoes: { atendidas: 0, nao_atendidas: 0, total: 0 },
        avg: { totalSeconds: 0, count: 0 }
      };

      const statsPerUser: Record<string, any> = {};

      perfData.forEach(p => {
        resumo.totalTickets += p.total_tickets || 0;
        
        const tks = p.tickets || {};
        Object.values(tks).forEach((cat: any) => {
          resumo.canais.whatsapp += cat.whatsapp || 0;
          resumo.canais.instagram += cat.instagram || 0;
          resumo.canais.telefone += cat.telefone || 0;
        });

        resumo.csat.bom += p.csat_bom || 0;
        resumo.csat.ruim += p.csat_ruim || 0;
        resumo.csat.injusto += p.csat_injusto || 0;
        resumo.csat.nao_avaliado += p.csat_nao_avaliado || 0;

        const tmWpp = timeToSeconds(p.tm_primeira_resposta?.whatsapp);
        const tmInsta = timeToSeconds(p.tm_primeira_resposta?.instagram);
        if (tmWpp > 0) { resumo.tm.whatsapp += tmWpp; resumo.tm.countWpp++; }
        if (tmInsta > 0) { resumo.tm.instagram += tmInsta; resumo.tm.countInsta++; }

        resumo.ligacoes.atendidas += p.ligacoes_atendidas || 0;
        resumo.ligacoes.nao_atendidas += p.ligacoes_nao_atendidas || 0;

        const avgSec = timeToSeconds(p.avg_resposta);
        if (avgSec > 0) { resumo.avg.totalSeconds += avgSec; resumo.avg.count++; }

        if (!statsPerUser[p.user_id]) {
          statsPerUser[p.user_id] = {
            totalTickets: 0,
            csatBom: 0, csatRuim: 0,
            ligacoesAtendidas: 0,
            tmWpp: 0, countWpp: 0,
            tmInsta: 0, countInsta: 0,
            avg: 0, countAvg: 0
          };
        }
        const u = statsPerUser[p.user_id];
        u.totalTickets += p.total_tickets || 0;
        u.csatBom += p.csat_bom || 0;
        u.csatRuim += p.csat_ruim || 0;
        u.ligacoesAtendidas += p.ligacoes_atendidas || 0;
        if (tmWpp > 0) { u.tmWpp += tmWpp; u.countWpp++; }
        if (tmInsta > 0) { u.tmInsta += tmInsta; u.countInsta++; }
        if (avgSec > 0) { u.avg += avgSec; u.countAvg++; }
      });

      resumo.ligacoes.total = resumo.ligacoes.atendidas + resumo.ligacoes.nao_atendidas;

      setOpMetrics({
        totalTickets: resumo.totalTickets,
        canais: resumo.canais,
        csat: resumo.csat,
        tmWppSeconds: resumo.tm.countWpp > 0 ? resumo.tm.whatsapp / resumo.tm.countWpp : 0,
        tmInstaSeconds: resumo.tm.countInsta > 0 ? resumo.tm.instagram / resumo.tm.countInsta : 0,
        avgSeconds: resumo.avg.count > 0 ? resumo.avg.totalSeconds / resumo.avg.count : 0,
        ligacoes: resumo.ligacoes
      });

      // Calcular destaques
      let bCsat = { id: '', val: -1 };
      let bTickets = { id: '', val: -1 };
      let bLigacoes = { id: '', val: -1 };
      let bTmWpp = { id: '', val: Infinity };
      let bTmInsta = { id: '', val: Infinity };
      let bAvg = { id: '', val: Infinity };

      // Se filtrou por todos, calcular destaques globais, senão, não faz sentido destaques
      if (selectedUser === 'all') {
        Object.keys(statsPerUser).forEach(uid => {
          const u = statsPerUser[uid];
          
          const csatTotal = u.csatBom + u.csatRuim;
          const csatPerc = csatTotal > 0 ? (u.csatBom / csatTotal) * 100 : 0;
          if (csatPerc > bCsat.val && csatTotal > 0) { bCsat = { id: uid, val: csatPerc }; }
          
          if (u.totalTickets > bTickets.val) { bTickets = { id: uid, val: u.totalTickets }; }
          if (u.ligacoesAtendidas > bLigacoes.val) { bLigacoes = { id: uid, val: u.ligacoesAtendidas }; }
          
          const wppAvg = u.countWpp > 0 ? u.tmWpp / u.countWpp : Infinity;
          if (wppAvg < bTmWpp.val && u.countWpp > 0) { bTmWpp = { id: uid, val: wppAvg }; }
          
          const instaAvg = u.countInsta > 0 ? u.tmInsta / u.countInsta : Infinity;
          if (instaAvg < bTmInsta.val && u.countInsta > 0) { bTmInsta = { id: uid, val: instaAvg }; }
          
          const aAvg = u.countAvg > 0 ? u.avg / u.countAvg : Infinity;
          if (aAvg < bAvg.val && u.countAvg > 0) { bAvg = { id: uid, val: aAvg }; }
        });
      }

      setDestaques({
        csat: { nome: colabMap[bCsat.id] || 'N/A', val: bCsat.val },
        tickets: { nome: colabMap[bTickets.id] || 'N/A', val: bTickets.val },
        ligacoes: { nome: colabMap[bLigacoes.id] || 'N/A', val: bLigacoes.val },
        tmWpp: { nome: colabMap[bTmWpp.id] || 'N/A', val: bTmWpp.val },
        tmInsta: { nome: colabMap[bTmInsta.id] || 'N/A', val: bTmInsta.val },
        avg: { nome: colabMap[bAvg.id] || 'N/A', val: bAvg.val }
      });

      // Operational charts (grouped by date)
      const dateEvolMap: Record<string, any> = {};
      perfData.forEach(p => {
        const dArr = p.data_inicio.split('-');
        const dStr = `${dArr[2]}/${dArr[1]}`; // DD/MM format
        if (!dateEvolMap[dStr]) {
          dateEvolMap[dStr] = {
            data: dStr,
            origDate: new Date(p.data_inicio),
            tickets: 0,
            wpp: 0, insta: 0, tel: 0,
            catReclamacao: 0, catInformacao: 0, catSolicitacao: 0, catNotaFiscal: 0, catCioccoletti: 0, catOutros: 0,
            bom: 0, ruim: 0, injusto: 0, naoAvaliado: 0,
            tmWpp: 0, countWpp: 0,
            tmInsta: 0, countInsta: 0,
            avgSec: 0, countAvg: 0,
            ligAtendidas: 0, ligNaoAtendidas: 0, ligTotal: 0
          };
        }
        const item = dateEvolMap[dStr];
        item.tickets += p.total_tickets || 0;
        
        const tksRaw = p.tickets || {};
        const tks = typeof tksRaw === 'string' ? JSON.parse(tksRaw) : tksRaw;
        Object.entries(tks).forEach(([catKey, cat]: [string, any]) => {
          const sum = (cat?.whatsapp || 0) + (cat?.instagram || 0) + (cat?.telefone || 0);
          item.wpp += cat?.whatsapp || 0;
          item.insta += cat?.instagram || 0;
          item.tel += cat?.telefone || 0;
          
          if (catKey === 'reclamacao') item.catReclamacao += sum;
          else if (catKey === 'informacao') item.catInformacao += sum;
          else if (catKey === 'solicitacao') item.catSolicitacao += sum;
          else if (catKey === 'nota_fiscal') item.catNotaFiscal += sum;
          else if (catKey === 'cioccoletti') item.catCioccoletti += sum;
          else if (catKey === 'outros') item.catOutros += sum;
        });

        item.bom += p.csat_bom || 0;
        item.ruim += p.csat_ruim || 0;
        item.injusto += p.csat_injusto || 0;
        item.naoAvaliado += p.csat_nao_avaliado || 0;

        const tw = timeToSeconds(p.tm_primeira_resposta?.whatsapp);
        const ti = timeToSeconds(p.tm_primeira_resposta?.instagram);
        const ta = timeToSeconds(p.avg_resposta);
        if (tw > 0) { item.tmWpp += tw; item.countWpp++; }
        if (ti > 0) { item.tmInsta += ti; item.countInsta++; }
        if (ta > 0) { item.avgSec += ta; item.countAvg++; }

        item.ligAtendidas += p.ligacoes_atendidas || 0;
        item.ligNaoAtendidas += p.ligacoes_nao_atendidas || 0;
        item.ligTotal += (p.ligacoes_atendidas || 0) + (p.ligacoes_nao_atendidas || 0);
      });

      const chartsArr = Object.values(dateEvolMap).sort((a: any, b: any) => a.origDate.getTime() - b.origDate.getTime()).map((d: any) => ({
        data: d.data,
        tickets: d.tickets,
        wpp: d.wpp, insta: d.insta, tel: d.tel,
        reclamacao: d.catReclamacao,
        informacao: d.catInformacao,
        solicitacao: d.catSolicitacao,
        nota_fiscal: d.catNotaFiscal,
        cioccoletti: d.catCioccoletti,
        outros: d.catOutros,
        bom: d.bom, ruim: d.ruim, injusto: d.injusto, nao_avaliado: d.naoAvaliado,
        tmWpp: d.countWpp > 0 ? parseFloat((d.tmWpp / d.countWpp / 60).toFixed(2)) : 0,
        tmInsta: d.countInsta > 0 ? parseFloat((d.tmInsta / d.countInsta / 60).toFixed(2)) : 0,
        avg: d.countAvg > 0 ? parseFloat((d.avgSec / d.countAvg / 60).toFixed(2)) : 0,
        atendidas: d.ligAtendidas, nao_atendidas: d.ligNaoAtendidas, total: d.ligTotal
      }));

      setOpCharts(chartsArr);

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

  const tooltipFormatterTime = (value: number) => [`${Math.floor(value)}m ${Math.floor((value % 1) * 60)}s`, 'Tempo'];

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
                style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                <option value="all">Todos os Agentes</option>
                {isCollaborator ? (
                  colaboradores.filter(c => c.id === currentUserColabId).map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))
                ) : (
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
          <Loader2 className="animate-spin" size={32} color="var(--accent-color)" />
        </div>
      ) : (
        <>
          {/* =========================================
              BLOCO 1: RESUMO OPERACIONAL E QUALIDADE
          ============================================= */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="var(--accent-color)" /> Resumo Operacional
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            
            {/* Tickets por Canal (Modern UI) */}
            <div className="card" style={{ padding: '1.5rem', margin: 0, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageCircle size={14} color="#10B981" /> VOLUME POR CANAL
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {/* Wpp */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: '#10B981' }}>WhatsApp</span>
                    <span>{opMetrics.canais.whatsapp}</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${opMetrics.totalTickets > 0 ? (opMetrics.canais.whatsapp / opMetrics.totalTickets) * 100 : 0}%`, background: '#10B981', height: '100%' }}></div>
                  </div>
                </div>
                {/* Insta */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: '#E1306C' }}>Instagram</span>
                    <span>{opMetrics.canais.instagram}</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${opMetrics.totalTickets > 0 ? (opMetrics.canais.instagram / opMetrics.totalTickets) * 100 : 0}%`, background: '#E1306C', height: '100%' }}></div>
                  </div>
                </div>
                {/* Telefone */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: '#F97316' }}>Telefone</span>
                    <span>{opMetrics.canais.telefone}</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${opMetrics.totalTickets > 0 ? (opMetrics.canais.telefone / opMetrics.totalTickets) * 100 : 0}%`, background: '#F97316', height: '100%' }}></div>
                  </div>
                </div>
              </div>
              
              {/* Total Summary inside Channel Card */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL ATENDIDOS</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{opMetrics.totalTickets}</span>
              </div>
            </div>

            {/* Average & Qualidade */}
            <div className="card" style={{ padding: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.25rem' }}>MÉDIA DO PERÍODO (QUALIDADE)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: getScoreColor(metrics.mediaGeral), lineHeight: 1 }}>
                    {metrics.mediaGeral.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/5.0</span>
                  </div>
                </div>
                <Target size={32} color={getScoreColor(metrics.mediaGeral)} opacity={0.2} />
              </div>
              <div style={{ width: '100%', height: '1px', background: 'var(--border-color)' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.25rem' }}>AVERAGE (GERAL)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {secondsToTime(opMetrics.avgSeconds)}
                  </div>
                </div>
                <Clock size={32} color="var(--text-secondary)" opacity={0.2} />
              </div>
            </div>

            {/* CSAT Modern */}
            <div className="card" style={{ padding: '1.5rem', margin: 0, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Star size={14} color="#EAB308" /> ÍNDICE DE CSAT
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', lineHeight: 1 }}>{opMetrics.csat.bom}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.25rem', textTransform: 'uppercase' }}>Bom</span>
                </div>
                <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#EF4444', lineHeight: 1 }}>{opMetrics.csat.ruim}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.25rem', textTransform: 'uppercase' }}>Ruim</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>Injustos: <strong style={{ color: 'var(--text-primary)' }}>{opMetrics.csat.injusto}</strong></span>
                <span style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>N/A: <strong style={{ color: 'var(--text-primary)' }}>{opMetrics.csat.nao_avaliado}</strong></span>
              </div>
            </div>

            {/* TM 1a Resposta e Ligações */}
            <div className="card" style={{ padding: '0', margin: 0, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', flex: 1 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={14} color="#3B82F6" /> TM 1ª RESPOSTA
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>WhatsApp:</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{secondsToTime(opMetrics.tmWppSeconds)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Instagram:</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{secondsToTime(opMetrics.tmInstaSeconds)}</span>
                </div>
              </div>
              
              <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', flex: 1 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={14} color="#F97316" /> LIGAÇÕES
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ATENDIDAS</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>{opMetrics.ligacoes.atendidas}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PERDIDAS</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#EF4444' }}>{opMetrics.ligacoes.nao_atendidas}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', opacity: 0.3 }}>
                    {opMetrics.ligacoes.total}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* =========================================
              BLOCO 2: DESTAQUES (Só mostra se for Todos)
          ============================================= */}
          {selectedUser === 'all' && (
            <>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#EAB308" /> Destaques da Equipe
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                
                <div className="card" style={{ padding: '1.25rem', margin: 0, background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: '#8B5CF6', marginBottom: '0.5rem' }}>🏆 MELHOR QUALIDADE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{metrics.agenteDestaque.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}>Nota: <span style={{ color: 'var(--text-primary)' }}>{metrics.agenteDestaque.media.toFixed(1)}</span></div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: '#EAB308', marginBottom: '0.5rem' }}>⭐ MAIOR CSAT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.csat.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{destaques.csat.val.toFixed(1)}%</span> Positivo</div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>📈 MAIOR VOLUME TICKETS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.tickets.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{destaques.tickets.val}</span> tickets</div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>📞 MAIS LIGAÇÕES</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.ligacoes.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{destaques.ligacoes.val}</span> atendidas</div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: '#10B981', marginBottom: '0.5rem' }}>⚡ TM1ª WPP RÁPIDO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.tmWpp.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{secondsToTime(destaques.tmWpp.val)}</span></div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: '#E1306C', marginBottom: '0.5rem' }}>⚡ TM1ª INSTA RÁPIDO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.tmInsta.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{secondsToTime(destaques.tmInsta.val)}</span></div>
                </div>

                <div className="card" style={{ padding: '1.25rem', margin: 0, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px', color: '#3B82F6', marginBottom: '0.5rem' }}>⚡ AVERAGE RÁPIDO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{destaques.avg.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' }}><span style={{ color: 'var(--text-primary)' }}>{secondsToTime(destaques.avg.val)}</span></div>
                </div>
              </div>
            </>
          )}


          {/* =========================================
              BLOCO 3: GRÁFICOS OPERACIONAIS E QUALIDADE
          ============================================= */}
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Evolução e Tendências</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            
            {/* Gráfico de Qualidade (Existente) */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <TrendingUp size={18} color="var(--accent-color)" /> Qualidade (Média Final)
              </h3>
              <div style={{ width: '100%', height: 250 }}>
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
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="nota" name="Nota" stroke="var(--accent-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evolução de Tickets e CSAT */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Activity size={18} color="#10B981" /> Volume de Tickets
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="tickets" name="Total Tickets" stroke="#10B981" strokeWidth={3} dot={{r: 4}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tickets por Canal */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <MessageCircle size={18} color="#3B82F6" /> Volume por Canal
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="wpp" name="WhatsApp" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="insta" name="Instagram" stroke="#E1306C" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tel" name="Telefone" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tickets por Categoria */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Activity size={18} color="#8B5CF6" /> Tickets por Categoria
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="reclamacao" name="Reclamação" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="informacao" name="Informação" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="solicitacao" name="Solicitação" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="nota_fiscal" name="Nota Fiscal" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cioccoletti" name="Cioccoletti" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="outros" name="Outros" stroke="#6B7280" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tempo de 1a Resposta */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Clock size={18} color="#8B5CF6" /> Tempo de 1ª Resposta (Minutos)
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip formatter={tooltipFormatterTime as any} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="tmWpp" name="TM WhatsApp" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tmInsta" name="TM Instagram" stroke="#E1306C" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="avg" name="Average Geral" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evolução CSAT */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Star size={18} color="#EAB308" /> Evolução CSAT
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="bom" name="Bom" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="injusto" name="Injusto" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="nao_avaliado" name="Não Avaliado" stroke="#6B7280" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ruim" name="Ruim" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ligações */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Phone size={18} color="#F97316" /> Ligações Telefônicas
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="data" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="atendidas" name="Atendidas" stackId="a" fill="#10B981" />
                    <Bar dataKey="nao_atendidas" name="Perdidas" stackId="a" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Desempenho por Critério Gráfico */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={20} color="var(--accent-color)" /> Média por Critério de Avaliação (Qualidade)
              </h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={criteriosMedias} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                    <XAxis type="number" domain={[0, 5]} stroke="var(--text-secondary)" />
                    <YAxis type="category" dataKey="nome" stroke="var(--text-primary)" fontSize={12} width={140} tick={{fill: 'var(--text-secondary)'}} />
                    <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                    <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                      {criteriosMedias.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.media >= 4.5 ? 'var(--success)' : entry.media >= 3.5 ? 'var(--warning)' : 'var(--danger)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking */}
            <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="var(--accent-color)" /> Ranking de Agentes (Qualidade)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
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

          {/* Cards de Critérios (MÉDIAS) */}
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

        </>
      )}
    </div>
  );
}
