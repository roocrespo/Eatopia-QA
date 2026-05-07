import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, CheckCircle, AlertCircle, Calendar, User as UserIcon, BarChart3, Clock, Phone, Star, MessageCircle, Activity, Handshake, Plus, Trash2, Edit3 } from 'lucide-react';

type Collaborator = {
  id: string;
  nome: string;
};

const CATEGORIES = [
  { id: 'reclamacao', label: 'Reclamação' },
  { id: 'informacao', label: 'Informação' },
  { id: 'solicitacao', label: 'Solicitação' },
  { id: 'nota_fiscal', label: 'Nota Fiscal' },
  { id: 'cioccoletti', label: 'Cioccoletti' },
  { id: 'outros', label: 'Outros' },
];

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'telefone', label: 'Telefone' },
];

export default function Performance() {
  const [activeTab, setActiveTab] = useState<'zendesk' | 'gestor' | 'whatsapp' | 'resgate' | 'cioccoletti' | 'influencer' | 'making_memories'>('zendesk');
  const [zendeskSubTab, setZendeskSubTab] = useState<'produtividade' | 'envios'>('produtividade');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [unidades, setUnidades] = useState<{id: string, nome: string}[]>([]);
  
  // Filters
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  // Form State
  const [tickets, setTickets] = useState<Record<string, Record<string, number>>>(
    CATEGORIES.reduce((acc, cat) => {
      acc[cat.id] = CHANNELS.reduce((chAcc, ch) => {
        chAcc[ch.id] = 0;
        return chAcc;
      }, {} as Record<string, number>);
      return acc;
    }, {} as Record<string, Record<string, number>>)
  );

  const [csat, setCsat] = useState({
    bom: 0,
    ruim: 0,
    injusto: 0,
    nao_avaliado: 0
  });

  const [tm, setTm] = useState<Record<string, string>>({
    whatsapp: '00:00:00',
    instagram: '00:00:00',
    telefone: '00:00:00'
  });
  
  const [avgResposta, setAvgResposta] = useState('00:00:00');

  const [ligacoes, setLigacoes] = useState({
    atendidas: 0,
    nao_atendidas: 0
  });

  // Gestor State
  const [gestorRespostas, setGestorRespostas] = useState({ respostas: 0, sem_respostas: 0, meta: 0 });
  const [gestorTm, setGestorTm] = useState({ tm_primeira_resposta: '00:00:00', meta_tm_primeira_resposta: '00:00:00' });
  const [gestorAvg, setGestorAvg] = useState({ avg_resposta: '00:00:00', meta_avg_resposta: '00:00:00' });
  const [gestorHandshake, setGestorHandshake] = useState({ respondidos: 0, expirados: 0, meta: 0 });
  const [gestorSolicitacoes, setGestorSolicitacoes] = useState({ respondidos: 0, expirados: 0, meta: 0 });

  // WhatsApp State
  const [whatsappMode, setWhatsappMode] = useState<'colaborador' | 'unidade'>('colaborador');
  const [whatsappColabData, setWhatsappColabData] = useState<any[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<string>('Manhã');
  const [whatsappUnidadeTm, setWhatsappUnidadeTm] = useState<string>('00:00:00');

  // Resgate State
  const [resgateMode, setResgateMode] = useState<'outbound' | 'produtividade'>('outbound');
  const [resgateOutbound, setResgateOutbound] = useState({ mensagens_enviadas: 0, clientes_responderam: 0 });
  const [resgateProdutividade, setResgateProdutividade] = useState({
    res_desculpas: 0, res_reembolso: 0, res_cortesia: 0, res_nova_experiencia: 0, res_encantamento: 0, res_mini_encantamento: 0,
    ret_elogio: 0, ret_reclamacao: 0, ret_indiferente: 0
  });

  // Cioccoletti State
  const [cioccolettiMode, setCioccolettiMode] = useState<'atendimentos' | 'envios'>('atendimentos');
  const [cioccolettiAtendimentos, setCioccolettiAtendimentos] = useState({ orcamentos_em_aberto: 0, vendas: 0, outros: 0, valor_faturado: 0.0 });
  const [cioccolettiEnvios, setCioccolettiEnvios] = useState({ envios_realizados: 0, valor_logistica: 0.0 });

  // Marcas State
  const [marcas, setMarcas] = useState<{id: string, nome: string}[]>([]);
  const [showMarcaForm, setShowMarcaForm] = useState(false);
  const [newMarcaNome, setNewMarcaNome] = useState('');
  const [editingMarcaId, setEditingMarcaId] = useState<string | null>(null);

  // Influencer & Making Memories State
  const [influencerData, setInfluencerData] = useState<any[]>([]);
  const [makingMemoriesData, setMakingMemoriesData] = useState<any[]>([]);

  // Zendesk Envios State
  const [zendeskEnviosForm, setZendeskEnviosForm] = useState({
    data_inicio: '',
    data_fim: '',
    valor_logistica: 0,
    valor_itens: 0
  });

  const calcPercent = (val: number, total: number) => {
    if (total === 0) return '0.0';
    return ((val / total) * 100).toFixed(1);
  };

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchCollaborators();
    fetchUnidades();
    fetchMarcas();
  }, []);

  useEffect(() => {
    if (dateStart && dateEnd) {
      if (activeTab === 'zendesk' && zendeskSubTab === 'produtividade' && selectedUserId) {
        fetchPerformanceData();
      } else if (activeTab === 'gestor' && selectedUserId) {
        fetchGestorData();
      } else if (activeTab === 'whatsapp') {
        if (whatsappMode === 'colaborador' && selectedUserId) fetchWhatsappData();
        if (whatsappMode === 'unidade' && selectedUnidadeId) fetchWhatsappData();
      } else if (activeTab === 'resgate') {
        if (resgateMode === 'outbound') fetchResgateOutbound();
        if (resgateMode === 'produtividade' && selectedUserId) fetchResgateProdutividade();
      } else if (activeTab === 'cioccoletti' && selectedUserId) {
        if (cioccolettiMode === 'atendimentos') fetchCioccolettiAtendimentos();
        if (cioccolettiMode === 'envios') fetchCioccolettiEnvios();
      } else if (activeTab === 'influencer' && selectedUserId) {
        fetchBrandTabData('performance_influencer', setInfluencerData);
      } else if (activeTab === 'making_memories' && selectedUserId) {
        fetchBrandTabData('performance_making_memories', setMakingMemoriesData);
      }
    }
  }, [selectedUserId, selectedUnidadeId, selectedTurno, dateStart, dateEnd, activeTab, whatsappMode, resgateMode, cioccolettiMode, unidades]);

  const fetchCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
    }
  };

  const fetchUnidades = async () => {
    try {
      const { data, error } = await supabase.from('unidades').select('*').order('nome');
      if (error) throw error;
      setUnidades(data || []);
    } catch (err) {
      console.error('Error fetching unidades:', err);
    }
  };

  const fetchMarcas = async () => {
    try {
      const { data, error } = await supabase.from('marcas').select('*').order('nome');
      if (error) throw error;
      setMarcas(data || []);
    } catch (err) {
      console.error('Error fetching marcas:', err);
    }
  };

  const handleSaveMarca = async () => {
    if (!newMarcaNome.trim()) return;
    try {
      if (editingMarcaId) {
        const { error } = await supabase.from('marcas').update({ nome: newMarcaNome.trim() }).eq('id', editingMarcaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marcas').insert({ nome: newMarcaNome.trim() });
        if (error) throw error;
      }
      setNewMarcaNome('');
      setEditingMarcaId(null);
      setShowMarcaForm(false);
      fetchMarcas();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar marca.' });
    }
  };

  const fetchBrandTabData = async (table: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd);
      if (error) throw error;
      setter(data && data.length > 0 ? data.map(d => ({ ...d, _key: Math.random().toString() })) : []);
    } catch (err: any) {
      console.error(`Error fetching ${table}:`, err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleBrandTabSubmit = async (table: string, rows: any[], setter: React.Dispatch<React.SetStateAction<any[]>>, label: string) => {
    if (!selectedUserId || !dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o colaborador e o período.' });
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      const marcaIds = rows.filter(r => r.marca_id).map(r => r.marca_id);
      const uniqueIds = new Set(marcaIds);
      if (uniqueIds.size !== marcaIds.length) {
        throw new Error('Não é permitido adicionar a mesma marca mais de uma vez.');
      }

      // Delete existing for user+period, then insert fresh
      await supabase.from(table).delete()
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd);

      const payload = rows.filter(r => r.marca_id).map(r => ({
        user_id: selectedUserId,
        data_inicio: dateStart,
        data_fim: dateEnd,
        marca_id: r.marca_id,
        lancamentos_pacme: r.lancamentos_pacme || 0,
        acionamentos_entrega: r.acionamentos_entrega || 0,
      }));

      if (payload.length > 0) {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }

      setter([]);
      setFeedback({ type: 'success', message: `Desempenho ${label} salvo com sucesso!` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || `Erro ao salvar dados de ${label}.` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleZendeskEnviosSubmit = async () => {
    if (!zendeskEnviosForm.data_inicio || !zendeskEnviosForm.data_fim) {
      setFeedback({ type: 'error', message: 'Selecione o período (Início e Fim).' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    const valorTotal = (Number(zendeskEnviosForm.valor_logistica) || 0) + (Number(zendeskEnviosForm.valor_itens) || 0);

    try {
      const { error } = await supabase
        .from('zendesk_envios')
        .insert([{
          data_inicio: zendeskEnviosForm.data_inicio,
          data_fim: zendeskEnviosForm.data_fim,
          valor_logistica: zendeskEnviosForm.valor_logistica,
          valor_itens: zendeskEnviosForm.valor_itens,
          valor_total: valorTotal
        }]);

      if (error) throw error;

      setZendeskEnviosForm({
        data_inicio: '',
        data_fim: '',
        valor_logistica: 0,
        valor_itens: 0
      });

      setFeedback({ type: 'success', message: 'Custos de envios salvos com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Error saving zendesk envios:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar dados de envios.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGestorData = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_gestor')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setGestorRespostas({ respostas: data.total_respostas || 0, sem_respostas: data.total_sem_respostas || 0, meta: data.meta_resposta_percentual || 0 });
        setGestorTm({ tm_primeira_resposta: data.tm_primeira_resposta || '00:00:00', meta_tm_primeira_resposta: data.meta_tm_primeira_resposta || '00:00:00' });
        setGestorAvg({ avg_resposta: data.avg_resposta || '00:00:00', meta_avg_resposta: data.meta_avg_resposta || '00:00:00' });
        setGestorHandshake({ respondidos: data.handshake_respondidos || 0, expirados: data.handshake_expirados || 0, meta: data.meta_handshake || 0 });
        setGestorSolicitacoes({ respondidos: data.solicitacoes_respondidos || 0, expirados: data.solicitacoes_expirados || 0, meta: data.meta_solicitacoes || 0 });
      } else {
        setGestorRespostas({ respostas: 0, sem_respostas: 0, meta: 0 });
        setGestorTm({ tm_primeira_resposta: '00:00:00', meta_tm_primeira_resposta: '00:00:00' });
        setGestorAvg({ avg_resposta: '00:00:00', meta_avg_resposta: '00:00:00' });
        setGestorHandshake({ respondidos: 0, expirados: 0, meta: 0 });
        setGestorSolicitacoes({ respondidos: 0, expirados: 0, meta: 0 });
      }
    } catch (err: any) {
      console.error('Error fetching gestor data:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchWhatsappData = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      if (whatsappMode === 'colaborador') {
        const { data, error } = await supabase
          .from('performance_whatsapp_colaborador')
          .select('*')
          .eq('user_id', selectedUserId)
          .eq('data_inicio', dateStart)
          .eq('data_fim', dateEnd);

        if (error) throw error;
        setWhatsappColabData(data && data.length > 0 ? data.map(d => ({ ...d, id: Math.random().toString() })) : []);
      } else {
        const { data, error } = await supabase
          .from('performance_whatsapp_unidade')
          .select('*')
          .eq('unidade_id', selectedUnidadeId)
          .eq('data_inicio', dateStart)
          .eq('data_fim', dateEnd)
          .eq('turno', selectedTurno)
          .maybeSingle();

        if (error) throw error;
        setWhatsappUnidadeTm(data ? data.tm_unidade : '00:00:00');
      }
    } catch (err: any) {
      console.error('Error fetching whatsapp data:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchResgateOutbound = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_resgate_outbound')
        .select('*')
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // ignore 0 rows
      setResgateOutbound(data || { mensagens_enviadas: 0, clientes_responderam: 0 });
    } catch (err: any) {
      console.error('Error fetching resgate outbound:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchResgateProdutividade = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_resgate_produtividade')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setResgateProdutividade(data || {
        res_desculpas: 0, res_reembolso: 0, res_cortesia: 0, res_nova_experiencia: 0, res_encantamento: 0, res_mini_encantamento: 0,
        ret_elogio: 0, ret_reclamacao: 0, ret_indiferente: 0
      });
    } catch (err: any) {
      console.error('Error fetching resgate produtividade:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchCioccolettiAtendimentos = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_cioccoletti_atendimentos')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setCioccolettiAtendimentos(data || { orcamentos_em_aberto: 0, vendas: 0, outros: 0, valor_faturado: 0 });
    } catch (err: any) {
      console.error('Error fetching cioccoletti atendimentos:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchCioccolettiEnvios = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_cioccoletti_envios')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setCioccolettiEnvios(data || { envios_realizados: 0, valor_logistica: 0 });
    } catch (err: any) {
      console.error('Error fetching cioccoletti envios:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const fetchPerformanceData = async () => {
    setIsFetchingData(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('performance_zendesk')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('data_inicio', dateStart)
        .eq('data_fim', dateEnd)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTickets(data.tickets);
        setCsat({
          bom: data.csat_bom,
          ruim: data.csat_ruim,
          injusto: data.csat_injusto,
          nao_avaliado: data.csat_nao_avaliado
        });
        setTm(data.tm_primeira_resposta);
        setAvgResposta(data.avg_resposta || '00:00:00');
        setLigacoes({
          atendidas: data.ligacoes_atendidas,
          nao_atendidas: data.ligacoes_nao_atendidas
        });
      } else {
        // Reset to default
        setTickets(
          CATEGORIES.reduce((acc, cat) => {
            acc[cat.id] = CHANNELS.reduce((chAcc, ch) => {
              chAcc[ch.id] = 0;
              return chAcc;
            }, {} as Record<string, number>);
            return acc;
          }, {} as Record<string, Record<string, number>>)
        );
        setCsat({ bom: 0, ruim: 0, injusto: 0, nao_avaliado: 0 });
        setTm({ whatsapp: '00:00:00', instagram: '00:00:00', telefone: '00:00:00' });
        setAvgResposta('00:00:00');
        setLigacoes({ atendidas: 0, nao_atendidas: 0 });
      }
    } catch (err: any) {
      console.error('Error fetching performance:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleTicketChange = (categoryId: string, channelId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setTickets(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [channelId]: numValue
      }
    }));
  };

  const handleCsatChange = (field: keyof typeof csat, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setCsat(prev => ({ ...prev, [field]: numValue }));
  };

  const handleLigacoesChange = (field: keyof typeof ligacoes, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setLigacoes(prev => ({ ...prev, [field]: numValue }));
  };

  const handleTmChange = (channelId: string, value: string) => {
    setTm(prev => ({ ...prev, [channelId]: value }));
  };

  // Calculations
  const totalsByChannel = useMemo(() => {
    return CHANNELS.reduce((acc, ch) => {
      acc[ch.id] = CATEGORIES.reduce((sum, cat) => sum + (tickets[cat.id]?.[ch.id] || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [tickets]);

  const totalsByCategory = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat.id] = CHANNELS.reduce((sum, ch) => sum + (tickets[cat.id]?.[ch.id] || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [tickets]);

  const totalTickets = useMemo(() => {
    return Object.values(totalsByChannel).reduce((sum, val) => sum + val, 0);
  }, [totalsByChannel]);

  const totalCsat = useMemo(() => {
    return csat.bom + csat.ruim + csat.injusto + csat.nao_avaliado;
  }, [csat]);

  const handleSubmit = async () => {
    if (!selectedUserId || !dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o colaborador e o período.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const payload = {
        user_id: selectedUserId,
        data_inicio: dateStart,
        data_fim: dateEnd,
        tickets,
        total_tickets: totalTickets,
        csat_bom: csat.bom,
        csat_ruim: csat.ruim,
        csat_injusto: csat.injusto,
        csat_nao_avaliado: csat.nao_avaliado,
        tm_primeira_resposta: tm,
        avg_resposta: avgResposta,
        ligacoes_atendidas: ligacoes.atendidas,
        ligacoes_nao_atendidas: ligacoes.nao_atendidas
      };

      const { error } = await supabase
        .from('performance_zendesk')
        .upsert(payload, { onConflict: 'user_id,data_inicio,data_fim' });

      if (error) throw error;
      
      setFeedback({ type: 'success', message: 'Desempenho salvo com sucesso!' });
      
      // Limpar campos
      setTickets(
        CATEGORIES.reduce((acc, cat) => {
          acc[cat.id] = CHANNELS.reduce((chAcc, ch) => {
            chAcc[ch.id] = 0;
            return chAcc;
          }, {} as Record<string, number>);
          return acc;
        }, {} as Record<string, Record<string, number>>)
      );
      setCsat({ bom: 0, ruim: 0, injusto: 0, nao_avaliado: 0 });
      setTm({ whatsapp: '00:00:00', instagram: '00:00:00', telefone: '00:00:00' });
      setAvgResposta('00:00:00');
      setLigacoes({ atendidas: 0, nao_atendidas: 0 });

      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar os dados.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGestorSubmit = async () => {
    if (!selectedUserId || !dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o colaborador e o período.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const payload = {
        user_id: selectedUserId,
        data_inicio: dateStart,
        data_fim: dateEnd,
        
        total_respostas: gestorRespostas.respostas,
        total_sem_respostas: gestorRespostas.sem_respostas,
        meta_resposta_percentual: gestorRespostas.meta,
        
        tm_primeira_resposta: gestorTm.tm_primeira_resposta,
        meta_tm_primeira_resposta: gestorTm.meta_tm_primeira_resposta,
        
        avg_resposta: gestorAvg.avg_resposta,
        meta_avg_resposta: gestorAvg.meta_avg_resposta,
        
        handshake_respondidos: gestorHandshake.respondidos,
        handshake_expirados: gestorHandshake.expirados,
        meta_handshake: gestorHandshake.meta,
        
        solicitacoes_respondidos: gestorSolicitacoes.respondidos,
        solicitacoes_expirados: gestorSolicitacoes.expirados,
        meta_solicitacoes: gestorSolicitacoes.meta,
      };

      const { error } = await supabase
        .from('performance_gestor')
        .upsert(payload, { onConflict: 'user_id,data_inicio,data_fim' });

      if (error) throw error;
      
      setFeedback({ type: 'success', message: 'Desempenho do Gestor salvo com sucesso!' });
      
      // Limpar campos, mantendo as metas
      setGestorRespostas(prev => ({ respostas: 0, sem_respostas: 0, meta: prev.meta }));
      setGestorTm(prev => ({ tm_primeira_resposta: '00:00:00', meta_tm_primeira_resposta: prev.meta_tm_primeira_resposta }));
      setGestorAvg(prev => ({ avg_resposta: '00:00:00', meta_avg_resposta: prev.meta_avg_resposta }));
      setGestorHandshake(prev => ({ respondidos: 0, expirados: 0, meta: prev.meta }));
      setGestorSolicitacoes(prev => ({ respondidos: 0, expirados: 0, meta: prev.meta }));

      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar os dados do gestor.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsappSubmit = async () => {
    if (!dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o período.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (whatsappMode === 'colaborador') {
        if (!selectedUserId) throw new Error('Selecione o colaborador.');
        
        // Validation: uniqueness of unidade in the same period
        const unidadesSet = new Set(whatsappColabData.map(d => d.unidade_id));
        if (unidadesSet.size !== whatsappColabData.length) {
          throw new Error('Não é permitido adicionar a mesma unidade mais de uma vez.');
        }

        const payload = whatsappColabData.filter(d => d.unidade_id).map(d => {
          const total = (d.rt || 0) + (d.troca_item || 0) + (d.duvidas || 0) + (d.pedidos || 0) + (d.outros || 0);
          return {
            user_id: selectedUserId,
            unidade_id: d.unidade_id,
            data_inicio: dateStart,
            data_fim: dateEnd,
            rt: d.rt || 0,
            troca_item: d.troca_item || 0,
            duvidas: d.duvidas || 0,
            pedidos: d.pedidos || 0,
            outros: d.outros || 0,
            total_solicitacoes: total,
            tm_colaborador: d.tm_colaborador || '00:00:00',
          };
        });

        // Delete existing for same range and user, then insert fresh
        await supabase
          .from('performance_whatsapp_colaborador')
          .delete()
          .eq('user_id', selectedUserId)
          .eq('data_inicio', dateStart)
          .eq('data_fim', dateEnd);

        if (payload.length > 0) {
          const { error } = await supabase.from('performance_whatsapp_colaborador').insert(payload);
          if (error) throw error;
        }
      } else {
        if (!selectedUnidadeId) throw new Error('Selecione a unidade.');

        const payload = {
          unidade_id: selectedUnidadeId,
          data_inicio: dateStart,
          data_fim: dateEnd,
          turno: selectedTurno,
          tm_unidade: whatsappUnidadeTm
        };

        const { error } = await supabase
          .from('performance_whatsapp_unidade')
          .upsert(payload, { onConflict: 'unidade_id,data_inicio,data_fim,turno' });

        if (error) throw error;
      }

      setFeedback({ type: 'success', message: 'Desempenho do WhatsApp salvo com sucesso!' });
      
      // Auto-clear
      if (whatsappMode === 'colaborador') {
        setWhatsappColabData([]);
      } else {
        setWhatsappUnidadeTm('00:00:00');
      }

      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar os dados do WhatsApp.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResgateSubmit = async () => {
    if (!dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o período.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (resgateMode === 'outbound') {
        const payload = {
          data_inicio: dateStart,
          data_fim: dateEnd,
          mensagens_enviadas: resgateOutbound.mensagens_enviadas || 0,
          clientes_responderam: resgateOutbound.clientes_responderam || 0,
        };
        const { error } = await supabase.from('performance_resgate_outbound').upsert(payload, { onConflict: 'data_inicio,data_fim' });
        if (error) throw error;
        
        setResgateOutbound({ mensagens_enviadas: 0, clientes_responderam: 0 });
      } else {
        if (!selectedUserId) throw new Error('Selecione o colaborador.');
        
        const totalResolucao = 
          (resgateProdutividade.res_desculpas || 0) + 
          (resgateProdutividade.res_reembolso || 0) + 
          (resgateProdutividade.res_cortesia || 0) + 
          (resgateProdutividade.res_nova_experiencia || 0) + 
          (resgateProdutividade.res_encantamento || 0) + 
          (resgateProdutividade.res_mini_encantamento || 0);

        const totalRetorno = 
          (resgateProdutividade.ret_elogio || 0) + 
          (resgateProdutividade.ret_reclamacao || 0) + 
          (resgateProdutividade.ret_indiferente || 0);

        if (totalRetorno > totalResolucao) {
           throw new Error('A soma dos retornos não pode ser maior que o total de atendimentos.');
        }

        const payload = {
          user_id: selectedUserId,
          data_inicio: dateStart,
          data_fim: dateEnd,
          res_desculpas: resgateProdutividade.res_desculpas || 0,
          res_reembolso: resgateProdutividade.res_reembolso || 0,
          res_cortesia: resgateProdutividade.res_cortesia || 0,
          res_nova_experiencia: resgateProdutividade.res_nova_experiencia || 0,
          res_encantamento: resgateProdutividade.res_encantamento || 0,
          res_mini_encantamento: resgateProdutividade.res_mini_encantamento || 0,
          ret_elogio: resgateProdutividade.ret_elogio || 0,
          ret_reclamacao: resgateProdutividade.ret_reclamacao || 0,
          ret_indiferente: resgateProdutividade.ret_indiferente || 0
        };
        const { error } = await supabase.from('performance_resgate_produtividade').upsert(payload, { onConflict: 'user_id,data_inicio,data_fim' });
        if (error) throw error;

        setResgateProdutividade({
          res_desculpas: 0, res_reembolso: 0, res_cortesia: 0, res_nova_experiencia: 0, res_encantamento: 0, res_mini_encantamento: 0,
          ret_elogio: 0, ret_reclamacao: 0, ret_indiferente: 0
        });
      }

      setFeedback({ type: 'success', message: 'Desempenho de Resgate salvo com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar os dados de Resgate.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCioccolettiSubmit = async () => {
    if (!selectedUserId || !dateStart || !dateEnd) {
      setFeedback({ type: 'error', message: 'Selecione o colaborador e o período.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (cioccolettiMode === 'atendimentos') {
        const payload = {
          user_id: selectedUserId,
          data_inicio: dateStart,
          data_fim: dateEnd,
          orcamentos_em_aberto: cioccolettiAtendimentos.orcamentos_em_aberto || 0,
          vendas: cioccolettiAtendimentos.vendas || 0,
          outros: cioccolettiAtendimentos.outros || 0,
          valor_faturado: cioccolettiAtendimentos.valor_faturado || 0,
        };
        const { error } = await supabase.from('performance_cioccoletti_atendimentos').upsert(payload, { onConflict: 'user_id,data_inicio,data_fim' });
        if (error) throw error;
        
        setCioccolettiAtendimentos({ orcamentos_em_aberto: 0, vendas: 0, outros: 0, valor_faturado: 0 });
      } else {
        const payload = {
          user_id: selectedUserId,
          data_inicio: dateStart,
          data_fim: dateEnd,
          envios_realizados: cioccolettiEnvios.envios_realizados || 0,
          valor_logistica: cioccolettiEnvios.valor_logistica || 0,
        };
        const { error } = await supabase.from('performance_cioccoletti_envios').upsert(payload, { onConflict: 'user_id,data_inicio,data_fim' });
        if (error) throw error;

        setCioccolettiEnvios({ envios_realizados: 0, valor_logistica: 0 });
      }

      setFeedback({ type: 'success', message: 'Desempenho Cioccoletti salvo com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar os dados Cioccoletti.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BarChart3 size={28} color="var(--accent-color)" />
          Desempenho
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Acompanhe métricas quantitativas de performance da equipe.</p>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('zendesk')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'zendesk' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'zendesk' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Zendesk
        </button>
        <button
          onClick={() => setActiveTab('gestor')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'gestor' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'gestor' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Gestor
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'whatsapp' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'whatsapp' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('resgate')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'resgate' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'resgate' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Resgate
        </button>
        <button
          onClick={() => setActiveTab('cioccoletti')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'cioccoletti' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'cioccoletti' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Cioccoletti
        </button>
        <button
          onClick={() => setActiveTab('influencer')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'influencer' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'influencer' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Influencer
        </button>
        <button
          onClick={() => setActiveTab('making_memories')}
          style={{
            background: 'none', border: 'none', padding: '1rem 1.5rem', cursor: 'pointer',
            fontSize: '1rem', fontWeight: 500, color: activeTab === 'making_memories' ? 'var(--accent-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'making_memories' ? '2px solid var(--accent-color)' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Making Memories
        </button>
      </div>

      {activeTab === 'zendesk' && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setZendeskSubTab('produtividade')}
            style={{
              background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
              fontSize: '0.95rem', fontWeight: 500, color: zendeskSubTab === 'produtividade' ? 'var(--accent-color)' : 'var(--text-secondary)',
              borderBottom: zendeskSubTab === 'produtividade' ? '2px solid var(--accent-color)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Produtividade
          </button>
          <button
            onClick={() => setZendeskSubTab('envios')}
            style={{
              background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
              fontSize: '0.95rem', fontWeight: 500, color: zendeskSubTab === 'envios' ? 'var(--accent-color)' : 'var(--text-secondary)',
              borderBottom: zendeskSubTab === 'envios' ? '2px solid var(--accent-color)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Envios
          </button>
        </div>
      )}

      {activeTab === 'zendesk' ? (
        zendeskSubTab === 'produtividade' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Filters Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={20} /> Filtros
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Colaborador</label>
                <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            
            {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
          </div>

          {(selectedUserId && dateStart && dateEnd) ? (
            <>
              {/* Tickets Section */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={20} color="var(--accent-color)" /> Tickets por Categoria e Canal
                  </h2>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                    Total Geral: <span style={{ color: 'var(--accent-color)' }}>{totalTickets}</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Categoria</th>
                        {CHANNELS.map(ch => (
                          <th key={ch.id} style={thStyle}>{ch.label}</th>
                        ))}
                        <th style={{ ...thStyle, color: 'var(--accent-color)' }}>Total Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map(cat => (
                        <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={tdStyle}><strong>{cat.label}</strong></td>
                          {CHANNELS.map(ch => (
                            <td key={ch.id} style={tdStyle}>
                              <input
                                type="number"
                                min="0"
                                className="form-input"
                                style={{ width: '100px', padding: '0.4rem' }}
                                value={tickets[cat.id]?.[ch.id] || ''}
                                onChange={e => handleTicketChange(cat.id, ch.id, e.target.value)}
                              />
                            </td>
                          ))}
                          <td style={{ ...tdStyle, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {totalsByCategory[cat.id]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-primary)', fontWeight: 'bold' }}>
                        <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)' }}>Total por Canal</td>
                        {CHANNELS.map(ch => (
                          <td key={ch.id} style={{ ...tdStyle, borderTop: '2px solid var(--border-color)', color: 'var(--accent-color)' }}>
                            {totalsByChannel[ch.id]}
                          </td>
                        ))}
                        <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)' }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Grid for CSAT, Tempo de Resposta, Ligações */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                
                {/* CSAT Card */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={20} color="var(--accent-color)" /> CSAT
                    </div>
                    <span style={{ fontSize: '0.9rem', padding: '0.2rem 0.6rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      Total: {totalCsat}
                    </span>
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Bom</label>
                      <input type="number" min="0" className="form-input" value={csat.bom || ''} onChange={e => handleCsatChange('bom', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Ruim</label>
                      <input type="number" min="0" className="form-input" value={csat.ruim || ''} onChange={e => handleCsatChange('ruim', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Injusto</label>
                      <input type="number" min="0" className="form-input" value={csat.injusto || ''} onChange={e => handleCsatChange('injusto', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Não Avaliados</label>
                      <input type="number" min="0" className="form-input" value={csat.nao_avaliado || ''} onChange={e => handleCsatChange('nao_avaliado', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Tempo de Resposta */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="var(--accent-color)" /> Tempo de Resposta (mm:ss)
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {CHANNELS.map(ch => (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ color: 'var(--text-secondary)' }}>{ch.label}</label>
                        <input 
                          type="time" 
                          step="1"
                          className="form-input" 
                          style={{ width: '130px' }} 
                          value={tm[ch.id] || ''} 
                          onChange={e => handleTmChange(ch.id, e.target.value)} 
                        />
                      </div>
                    ))}
                    <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: 'bold' }}>Average (Geral)</label>
                      <input 
                        type="time" 
                        step="1"
                        className="form-input" 
                        style={{ width: '130px', borderColor: 'var(--accent-color)' }} 
                        value={avgResposta || ''} 
                        onChange={e => setAvgResposta(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                {/* Ligações */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={20} color="var(--accent-color)" /> Ligações
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Atendidas</label>
                      <input type="number" min="0" className="form-input" value={ligacoes.atendidas || ''} onChange={e => handleLigacoesChange('atendidas', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Não Atendidas</label>
                      <input type="number" min="0" className="form-input" value={ligacoes.nao_atendidas || ''} onChange={e => handleLigacoesChange('nao_atendidas', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Desempenho
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              Selecione um colaborador e defina o período (Data Início e Fim) para preencher os dados de desempenho.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="var(--accent-color)" /> Registrar Custos de Envios
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={zendeskEnviosForm.data_inicio} 
                  onChange={e => setZendeskEnviosForm(p => ({ ...p, data_inicio: e.target.value }))} 
                />
              </div>
              <div className="form-group">
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={zendeskEnviosForm.data_fim} 
                  onChange={e => setZendeskEnviosForm(p => ({ ...p, data_fim: e.target.value }))} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">🚚 Logística (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  placeholder="0,00"
                  value={zendeskEnviosForm.valor_logistica || ''} 
                  onChange={e => setZendeskEnviosForm(p => ({ ...p, valor_logistica: parseFloat(e.target.value) || 0 }))} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">📦 Itens (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="form-input" 
                  placeholder="0,00"
                  value={zendeskEnviosForm.valor_itens || ''} 
                  onChange={e => setZendeskEnviosForm(p => ({ ...p, valor_itens: parseFloat(e.target.value) || 0 }))} 
                />
              </div>
            </div>

            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: 'var(--bg-primary)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cálculo do Investimento Operacional</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  💰 Valor Total: <span style={{ color: 'var(--accent-color)' }}>
                    R$ {((Number(zendeskEnviosForm.valor_logistica) || 0) + (Number(zendeskEnviosForm.valor_itens) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </h3>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleZendeskEnviosSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Envios
                </button>
              </div>
            </div>
          </div>
        </div>
      )) : activeTab === 'gestor' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Filters Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={20} /> Filtros
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Colaborador</label>
                <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            
            {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
          </div>

          {(selectedUserId && dateStart && dateEnd) ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                
                {/* BLOCO: RESPOSTAS */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={20} color="var(--accent-color)" /> Respostas
                  </h2>
                  {(() => {
                     const total = gestorRespostas.respostas + gestorRespostas.sem_respostas;
                     const percRespostas = calcPercent(gestorRespostas.respostas, total);
                     const percSemRespostas = calcPercent(gestorRespostas.sem_respostas, total);
                     const bateuMeta = total > 0 && parseFloat(percRespostas) >= gestorRespostas.meta;
                     return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Total Respostas</label>
                            <input type="number" min="0" className="form-input" value={gestorRespostas.respostas || ''} onChange={e => setGestorRespostas(p => ({...p, respostas: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Total Sem Respostas</label>
                            <input type="number" min="0" className="form-input" value={gestorRespostas.sem_respostas || ''} onChange={e => setGestorRespostas(p => ({...p, sem_respostas: parseInt(e.target.value) || 0}))} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Meta (%)</label>
                            <input type="number" min="0" max="100" className="form-input" value={gestorRespostas.meta || ''} onChange={e => setGestorRespostas(p => ({...p, meta: parseFloat(e.target.value) || 0}))} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <div style={{ padding: '0.7rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</span>
                               {total === 0 ? <span style={{ color: 'var(--text-secondary)' }}>-</span> : (bateuMeta ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Atingida</span> : <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={16} /> Falhou</span>)}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span>Respostas: <strong>{percRespostas}%</strong></span>
                          <span>Sem Respostas: <strong>{percSemRespostas}%</strong></span>
                        </div>
                      </div>
                     );
                  })()}
                </div>

                {/* BLOCO: TEMPO DE 1ª RESPOSTA */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="#3B82F6" /> TM 1ª Resposta
                  </h2>
                  {(() => {
                     const bateuMeta = gestorTm.tm_primeira_resposta <= gestorTm.meta_tm_primeira_resposta && gestorTm.tm_primeira_resposta !== '00:00:00';
                     return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tempo Real (hh:mm:ss)</label>
                            <input type="time" step="1" className="form-input" value={gestorTm.tm_primeira_resposta} onChange={e => setGestorTm(p => ({...p, tm_primeira_resposta: e.target.value}))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Meta Alvo (hh:mm:ss)</label>
                            <input type="time" step="1" className="form-input" value={gestorTm.meta_tm_primeira_resposta} onChange={e => setGestorTm(p => ({...p, meta_tm_primeira_resposta: e.target.value}))} />
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status da Meta:</span>
                           {gestorTm.tm_primeira_resposta === '00:00:00' ? <span style={{ color: 'var(--text-secondary)' }}>-</span> : (bateuMeta ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Atingida</span> : <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={16} /> Acima da meta</span>)}
                        </div>
                      </div>
                     );
                  })()}
                </div>

                {/* BLOCO: AVERAGE */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="#8B5CF6" /> Average (Geral)
                  </h2>
                  {(() => {
                     const bateuMeta = gestorAvg.avg_resposta <= gestorAvg.meta_avg_resposta && gestorAvg.avg_resposta !== '00:00:00';
                     return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tempo Médio (hh:mm:ss)</label>
                            <input type="time" step="1" className="form-input" value={gestorAvg.avg_resposta} onChange={e => setGestorAvg(p => ({...p, avg_resposta: e.target.value}))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Meta Alvo (hh:mm:ss)</label>
                            <input type="time" step="1" className="form-input" value={gestorAvg.meta_avg_resposta} onChange={e => setGestorAvg(p => ({...p, meta_avg_resposta: e.target.value}))} />
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status da Meta:</span>
                           {gestorAvg.avg_resposta === '00:00:00' ? <span style={{ color: 'var(--text-secondary)' }}>-</span> : (bateuMeta ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Atingida</span> : <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={16} /> Acima da meta</span>)}
                        </div>
                      </div>
                     );
                  })()}
                </div>

                {/* BLOCO: HANDSHAKE */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Handshake size={20} color="#F59E0B" /> Handshake
                  </h2>
                  {(() => {
                     const total = gestorHandshake.respondidos + gestorHandshake.expirados;
                     const percResp = calcPercent(gestorHandshake.respondidos, total);
                     const percExp = calcPercent(gestorHandshake.expirados, total);
                     const bateuMeta = total > 0 && parseFloat(percResp) >= gestorHandshake.meta;
                     return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Respondidos</label>
                            <input type="number" min="0" className="form-input" value={gestorHandshake.respondidos || ''} onChange={e => setGestorHandshake(p => ({...p, respondidos: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Expirados</label>
                            <input type="number" min="0" className="form-input" value={gestorHandshake.expirados || ''} onChange={e => setGestorHandshake(p => ({...p, expirados: parseInt(e.target.value) || 0}))} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Meta (%)</label>
                            <input type="number" min="0" max="100" className="form-input" value={gestorHandshake.meta || ''} onChange={e => setGestorHandshake(p => ({...p, meta: parseFloat(e.target.value) || 0}))} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <div style={{ padding: '0.7rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</span>
                               {total === 0 ? <span style={{ color: 'var(--text-secondary)' }}>-</span> : (bateuMeta ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Atingida</span> : <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={16} /> Falhou</span>)}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span>Respondidos: <strong>{percResp}%</strong></span>
                          <span>Expirados: <strong>{percExp}%</strong></span>
                        </div>
                      </div>
                     );
                  })()}
                </div>

                {/* BLOCO: SOLICITAÇÕES */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} color="#10B981" /> Solicitações
                  </h2>
                  {(() => {
                     const total = gestorSolicitacoes.respondidos + gestorSolicitacoes.expirados;
                     const percResp = calcPercent(gestorSolicitacoes.respondidos, total);
                     const percExp = calcPercent(gestorSolicitacoes.expirados, total);
                     const bateuMeta = total > 0 && parseFloat(percResp) >= gestorSolicitacoes.meta;
                     return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Respondidos</label>
                            <input type="number" min="0" className="form-input" value={gestorSolicitacoes.respondidos || ''} onChange={e => setGestorSolicitacoes(p => ({...p, respondidos: parseInt(e.target.value) || 0}))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Expirados</label>
                            <input type="number" min="0" className="form-input" value={gestorSolicitacoes.expirados || ''} onChange={e => setGestorSolicitacoes(p => ({...p, expirados: parseInt(e.target.value) || 0}))} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Meta (%)</label>
                            <input type="number" min="0" max="100" className="form-input" value={gestorSolicitacoes.meta || ''} onChange={e => setGestorSolicitacoes(p => ({...p, meta: parseFloat(e.target.value) || 0}))} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <div style={{ padding: '0.7rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</span>
                               {total === 0 ? <span style={{ color: 'var(--text-secondary)' }}>-</span> : (bateuMeta ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Atingida</span> : <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={16} /> Falhou</span>)}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span>Respondidos: <strong>{percResp}%</strong></span>
                          <span>Expirados: <strong>{percExp}%</strong></span>
                        </div>
                      </div>
                     );
                  })()}
                </div>

              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleGestorSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Desempenho Gestor
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              Selecione um colaborador e defina o período (Data Início e Fim) para preencher os dados de desempenho do gestor.
            </div>
          )}
        </div>
      ) : activeTab === 'whatsapp' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setWhatsappMode('colaborador')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: whatsappMode === 'colaborador' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: whatsappMode === 'colaborador' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Modo Colaborador
            </button>
            <button
              onClick={() => setWhatsappMode('unidade')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: whatsappMode === 'unidade' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: whatsappMode === 'unidade' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Modo Unidade
            </button>
          </div>

          {/* Filters Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={20} /> Filtros - {whatsappMode === 'colaborador' ? 'Colaborador' : 'Unidade'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {whatsappMode === 'colaborador' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Colaborador</label>
                  <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Unidade</label>
                    <select className="form-input" value={selectedUnidadeId} onChange={e => setSelectedUnidadeId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Turno</label>
                    <select className="form-input" value={selectedTurno} onChange={e => setSelectedTurno(e.target.value)}>
                      <option value="Manhã">Manhã</option>
                      <option value="Noite">Noite</option>
                    </select>
                  </div>
                </>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            
            {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
          </div>

          {(whatsappMode === 'colaborador' ? (selectedUserId && dateStart && dateEnd) : (selectedUnidadeId && dateStart && dateEnd)) ? (
            <>
              {whatsappMode === 'colaborador' ? (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageCircle size={20} color="var(--success)" /> Performance Colaborador
                    </h2>
                    <button 
                      onClick={() => setWhatsappColabData([...whatsappColabData, { id: Math.random().toString(), unidade_id: '', rt: 0, troca_item: 0, duvidas: 0, pedidos: 0, outros: 0, tm_colaborador: '00:00:00' }])}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                      + Adicionar Unidade
                    </button>
                  </div>

                  {whatsappColabData.length === 0 ? (
                     <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                       Nenhuma unidade adicionada. Clique em "+ Adicionar Unidade" para começar.
                     </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{...thStyle, minWidth: '150px'}}>Unidade</th>
                            <th style={thStyle}>RT</th>
                            <th style={thStyle}>Troca Item</th>
                            <th style={thStyle}>Dúvidas</th>
                            <th style={thStyle}>Pedidos</th>
                            <th style={thStyle}>Outros</th>
                            <th style={thStyle}>Total</th>
                            <th style={{...thStyle, minWidth: '120px'}}>TM Colab (hh:mm:ss)</th>
                            <th style={thStyle}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatsappColabData.map((d, index) => {
                            const total = (d.rt || 0) + (d.troca_item || 0) + (d.duvidas || 0) + (d.pedidos || 0) + (d.outros || 0);
                            return (
                              <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={tdStyle}>
                                  <select 
                                    className="form-input" 
                                    value={d.unidade_id} 
                                    onChange={e => {
                                      const newData = [...whatsappColabData];
                                      newData[index].unidade_id = e.target.value;
                                      setWhatsappColabData(newData);
                                    }}
                                    style={{ width: '100%', padding: '0.4rem' }}
                                  >
                                    <option value="">Selecione...</option>
                                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                  </select>
                                </td>
                                <td style={tdStyle}><input type="number" min="0" className="form-input" style={{ width: '70px', padding: '0.4rem' }} value={d.rt || ''} onChange={e => { const nd = [...whatsappColabData]; nd[index].rt = parseInt(e.target.value)||0; setWhatsappColabData(nd); }} /></td>
                                <td style={tdStyle}><input type="number" min="0" className="form-input" style={{ width: '70px', padding: '0.4rem' }} value={d.troca_item || ''} onChange={e => { const nd = [...whatsappColabData]; nd[index].troca_item = parseInt(e.target.value)||0; setWhatsappColabData(nd); }} /></td>
                                <td style={tdStyle}><input type="number" min="0" className="form-input" style={{ width: '70px', padding: '0.4rem' }} value={d.duvidas || ''} onChange={e => { const nd = [...whatsappColabData]; nd[index].duvidas = parseInt(e.target.value)||0; setWhatsappColabData(nd); }} /></td>
                                <td style={tdStyle}><input type="number" min="0" className="form-input" style={{ width: '70px', padding: '0.4rem' }} value={d.pedidos || ''} onChange={e => { const nd = [...whatsappColabData]; nd[index].pedidos = parseInt(e.target.value)||0; setWhatsappColabData(nd); }} /></td>
                                <td style={tdStyle}><input type="number" min="0" className="form-input" style={{ width: '70px', padding: '0.4rem' }} value={d.outros || ''} onChange={e => { const nd = [...whatsappColabData]; nd[index].outros = parseInt(e.target.value)||0; setWhatsappColabData(nd); }} /></td>
                                <td style={{ ...tdStyle, fontWeight: 'bold', color: 'var(--accent-color)' }}>{total}</td>
                                <td style={tdStyle}><input type="time" step="1" className="form-input" style={{ width: '100%', padding: '0.4rem' }} value={d.tm_colaborador || '00:00:00'} onChange={e => { const nd = [...whatsappColabData]; nd[index].tm_colaborador = e.target.value; setWhatsappColabData(nd); }} /></td>
                                <td style={tdStyle}>
                                  <button onClick={() => setWhatsappColabData(whatsappColabData.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="var(--success)" /> Tempo Médio da Unidade
                  </h2>
                  <div className="form-group">
                    <label className="form-label">TM Unidade (hh:mm:ss)</label>
                    <input 
                      type="time" 
                      step="1" 
                      className="form-input" 
                      style={{ maxWidth: '200px' }}
                      value={whatsappUnidadeTm} 
                      onChange={e => setWhatsappUnidadeTm(e.target.value)} 
                    />
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleWhatsappSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Desempenho {whatsappMode === 'colaborador' ? 'Colaborador' : 'Unidade'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              Selecione {whatsappMode === 'colaborador' ? 'o colaborador' : 'a unidade'} e defina o período para preencher os dados.
            </div>
          )}
        </div>
      ) : activeTab === 'resgate' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setResgateMode('outbound')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: resgateMode === 'outbound' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: resgateMode === 'outbound' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Outbound
            </button>
            <button
              onClick={() => setResgateMode('produtividade')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: resgateMode === 'produtividade' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: resgateMode === 'produtividade' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Produtividade
            </button>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={20} /> Filtros - {resgateMode === 'outbound' ? 'Outbound' : 'Produtividade'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {resgateMode === 'produtividade' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Colaborador</label>
                  <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
          </div>

          {(resgateMode === 'outbound' ? (dateStart && dateEnd) : (selectedUserId && dateStart && dateEnd)) ? (
            <>
              {resgateMode === 'outbound' ? (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={20} color="var(--success)" /> Volume de Mensagens
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Quantidade de Mensagens Enviadas (Outbound)</label>
                      <input type="number" min="0" className="form-input" value={resgateOutbound.mensagens_enviadas || ''} onChange={e => setResgateOutbound(p => ({ ...p, mensagens_enviadas: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantidade de Clientes que Responderam</label>
                      <input type="number" min="0" className="form-input" value={resgateOutbound.clientes_responderam || ''} onChange={e => setResgateOutbound(p => ({ ...p, clientes_responderam: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={20} color="#3B82F6" /> 1. Contato com sucesso
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Desculpas</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_desculpas || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_desculpas: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Reembolso</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_reembolso || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_reembolso: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cortesia</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_cortesia || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_cortesia: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Nova Experiência</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_nova_experiencia || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_nova_experiencia: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Encantamento</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_encantamento || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_encantamento: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Mini Encantamento</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.res_mini_encantamento || ''} onChange={e => setResgateProdutividade(p => ({ ...p, res_mini_encantamento: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Atendimentos:</span>
                      <span style={{ color: 'var(--accent-color)' }}>
                        {(resgateProdutividade.res_desculpas || 0) + (resgateProdutividade.res_reembolso || 0) + (resgateProdutividade.res_cortesia || 0) + (resgateProdutividade.res_nova_experiencia || 0) + (resgateProdutividade.res_encantamento || 0) + (resgateProdutividade.res_mini_encantamento || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={20} color="#F59E0B" /> 2. Retorno do cliente
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Esses retornos devem estar dentro do total de atendimentos.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Elogiaram</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.ret_elogio || ''} onChange={e => setResgateProdutividade(p => ({ ...p, ret_elogio: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Continuaram Reclamando</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.ret_reclamacao || ''} onChange={e => setResgateProdutividade(p => ({ ...p, ret_reclamacao: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Indiferentes</label>
                        <input type="number" min="0" className="form-input" value={resgateProdutividade.ret_indiferente || ''} onChange={e => setResgateProdutividade(p => ({ ...p, ret_indiferente: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleResgateSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Desempenho {resgateMode === 'outbound' ? 'Outbound' : 'Produtividade'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              Defina o período {resgateMode === 'produtividade' && 'e o colaborador '}para preencher os dados.
            </div>
          )}
        </div>
      ) : activeTab === 'cioccoletti' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setCioccolettiMode('atendimentos')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: cioccolettiMode === 'atendimentos' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: cioccolettiMode === 'atendimentos' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Atendimentos e Vendas
            </button>
            <button
              onClick={() => setCioccolettiMode('envios')}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
                fontSize: '0.95rem', fontWeight: 500, color: cioccolettiMode === 'envios' ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: cioccolettiMode === 'envios' ? '2px solid var(--accent-color)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Envios de Encomendas
            </button>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={20} /> Filtros - {cioccolettiMode === 'atendimentos' ? 'Atendimentos e Vendas' : 'Envios de Encomendas'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Colaborador</label>
                <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
          </div>

          {(selectedUserId && dateStart && dateEnd) ? (
            <>
              {cioccolettiMode === 'atendimentos' ? (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} color="var(--success)" /> Atendimentos e Vendas
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Orçamentos em aberto</label>
                      <input type="number" min="0" className="form-input" value={cioccolettiAtendimentos.orcamentos_em_aberto || ''} onChange={e => setCioccolettiAtendimentos(p => ({ ...p, orcamentos_em_aberto: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Vendas (Pagou)</label>
                      <input type="number" min="0" className="form-input" value={cioccolettiAtendimentos.vendas || ''} onChange={e => setCioccolettiAtendimentos(p => ({ ...p, vendas: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Outros (Dúvidas, etc)</label>
                      <input type="number" min="0" className="form-input" value={cioccolettiAtendimentos.outros || ''} onChange={e => setCioccolettiAtendimentos(p => ({ ...p, outros: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Valor Faturado (R$)</label>
                      <input type="number" step="0.01" min="0" className="form-input" value={cioccolettiAtendimentos.valor_faturado || ''} onChange={e => setCioccolettiAtendimentos(p => ({ ...p, valor_faturado: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: '1.5rem', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total de Atendimentos:</span>
                    <span style={{ color: 'var(--accent-color)' }}>
                      {(cioccolettiAtendimentos.orcamentos_em_aberto || 0) + (cioccolettiAtendimentos.vendas || 0) + (cioccolettiAtendimentos.outros || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} color="#3B82F6" /> Envios de Encomendas
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Quantidade de Envios Realizados</label>
                      <input type="number" min="0" className="form-input" value={cioccolettiEnvios.envios_realizados || ''} onChange={e => setCioccolettiEnvios(p => ({ ...p, envios_realizados: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Valor da Logística (R$)</label>
                      <input type="number" step="0.01" min="0" className="form-input" value={cioccolettiEnvios.valor_logistica || ''} onChange={e => setCioccolettiEnvios(p => ({ ...p, valor_logistica: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                {feedback && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                  </div>
                )}
                <button 
                  onClick={handleCioccolettiSubmit} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Desempenho {cioccolettiMode === 'atendimentos' ? 'Atendimentos' : 'Envios'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              Selecione o colaborador e defina o período para preencher os dados.
            </div>
          )}
        </div>
      ) : (activeTab === 'influencer' || activeTab === 'making_memories') ? (() => {
        const tabLabel = activeTab === 'influencer' ? 'Influencer' : 'Making Memories';
        const tableName = activeTab === 'influencer' ? 'performance_influencer' : 'performance_making_memories';
        const rows = activeTab === 'influencer' ? influencerData : makingMemoriesData;
        const setRows = activeTab === 'influencer' ? setInfluencerData : setMakingMemoriesData;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Filters */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserIcon size={20} /> Filtros - {tabLabel}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Colaborador</label>
                  <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Início</label>
                  <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label"><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> Data Fim</label>
                  <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                </div>
              </div>
              {isFetchingData && <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> Carregando dados...</div>}
            </div>

            {/* Marca Management */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Star size={18} color="#F59E0B" /> Cadastro de Marcas
                </h2>
                <button
                  onClick={() => { setShowMarcaForm(!showMarcaForm); setEditingMarcaId(null); setNewMarcaNome(''); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                >
                  {showMarcaForm ? 'Cancelar' : '+ Nova Marca'}
                </button>
              </div>
              {showMarcaForm && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="form-label">{editingMarcaId ? 'Editar marca' : 'Nome da nova marca'}</label>
                    <input type="text" className="form-input" placeholder="Ex: Poke" value={newMarcaNome} onChange={e => setNewMarcaNome(e.target.value)} />
                  </div>
                  <button onClick={handleSaveMarca} className="btn btn-primary" style={{ padding: '0.55rem 1rem', fontSize: '0.9rem' }}>
                    <Save size={16} style={{ marginRight: 4 }} /> {editingMarcaId ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {marcas.map(m => (
                  <span key={m.id} style={{ background: 'var(--bg-tertiary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
                    {m.nome}
                    <button
                      onClick={() => { setEditingMarcaId(m.id); setNewMarcaNome(m.nome); setShowMarcaForm(true); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: 0 }}
                      title="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                  </span>
                ))}
                {marcas.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhuma marca cadastrada.</span>}
              </div>
            </div>

            {(selectedUserId && dateStart && dateEnd) ? (
              <>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={20} color="var(--success)" /> Registros por Marca
                    </h2>
                    <button
                      onClick={() => setRows([...rows, { _key: Math.random().toString(), marca_id: '', lancamentos_pacme: 0, acionamentos_entrega: 0 }])}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                      <Plus size={16} style={{ marginRight: 4 }} /> Adicionar Marca
                    </button>
                  </div>

                  {rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                      Nenhuma marca adicionada. Clique em "+ Adicionar Marca" para começar.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, minWidth: '180px' }}>Marca</th>
                            <th style={thStyle}>Lançamentos PAC-ME</th>
                            <th style={thStyle}>Acionamentos de Entrega</th>
                            <th style={thStyle}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row: any, index: number) => (
                            <tr key={row._key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={tdStyle}>
                                <select
                                  className="form-input"
                                  value={row.marca_id}
                                  onChange={e => { const nd = [...rows]; nd[index].marca_id = e.target.value; setRows(nd); }}
                                  style={{ width: '100%', padding: '0.4rem' }}
                                >
                                  <option value="">Selecione...</option>
                                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                              </td>
                              <td style={tdStyle}>
                                <input type="number" min="0" className="form-input" style={{ width: '100px', padding: '0.4rem' }} value={row.lancamentos_pacme || ''} onChange={e => { const nd = [...rows]; nd[index].lancamentos_pacme = parseInt(e.target.value) || 0; setRows(nd); }} />
                              </td>
                              <td style={tdStyle}>
                                <input type="number" min="0" className="form-input" style={{ width: '100px', padding: '0.4rem' }} value={row.acionamentos_entrega || ''} onChange={e => { const nd = [...rows]; nd[index].acionamentos_entrega = parseInt(e.target.value) || 0; setRows(nd); }} />
                              </td>
                              <td style={tdStyle}>
                                <button onClick={() => setRows(rows.filter((_: any, i: number) => i !== index))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Trash2 size={15} /> Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: 'var(--bg-primary)', fontWeight: 'bold' }}>
                            <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)' }}>Total</td>
                            <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)', color: 'var(--accent-color)' }}>
                              {rows.reduce((s: number, r: any) => s + (r.lancamentos_pacme || 0), 0)}
                            </td>
                            <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)', color: 'var(--accent-color)' }}>
                              {rows.reduce((s: number, r: any) => s + (r.acionamentos_entrega || 0), 0)}
                            </td>
                            <td style={{ ...tdStyle, borderTop: '2px solid var(--border-color)' }}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                  {feedback && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                      {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                      {feedback.message}
                    </div>
                  )}
                  <button
                    onClick={() => handleBrandTabSubmit(tableName, rows, setRows, tabLabel)}
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Desempenho {tabLabel}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                Selecione o colaborador e defina o período para preencher os dados.
              </div>
            )}
          </div>
        );
      })() : null}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '1rem',
  borderBottom: '2px solid var(--border-color)',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: '0.9rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
};
