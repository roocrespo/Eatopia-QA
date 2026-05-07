import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  DndContext, closestCorners, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, X, Save, Loader2, CheckCircle, AlertCircle, Clock, Tag,
  Calendar, GripVertical, Sparkles, Edit3, DollarSign,
  TrendingUp, Package, LayoutDashboard, Kanban as KanbanIcon,
  Filter, Download, ArrowRight, History
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

// Types
// Types
type HistoryEntry = { 
  id: string;
  encantamento_id: string; 
  etapa_anterior: string; 
  etapa_nova: string; 
  moved_at: string 
};

type Encantamento = {
  id: string;
  cliente_nome: string;
  ticket_numero: string;
  telefone: string;
  marca_id: string | null;
  origem_id: string | null;
  motivo: string;
  status: string;
  observacoes_cliente: string | null;
  planejamento_descricao: string | null;
  planejamento_itens: string | null;
  planejamento_experiencia: string | null;
  valor_gasto: number;
  agendamento_data: string | null;
  agendamento_horario: string | null;
  endereco_completo: string | null;
  created_at: string;
  completed_at: string | null;
  position: number;
  _lastMoveAt?: string;
};

type Marca = { id: string; nome: string };
type Origem = { id: string; nome: string };

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: '#6B7280' },
  { id: 'em_contato', label: 'Em Contato', color: '#3B82F6' },
  { id: 'planejamento', label: 'Planejamento', color: '#F59E0B' },
  { id: 'agendados', label: 'Agendados', color: '#8B5CF6' },
  { id: 'em_andamento', label: 'Em Andamento', color: '#F97316' },
  { id: 'concluido', label: 'Concluído', color: '#10B981' },
];

// Helper: days since date
function daysSince(dateStr: string): number {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
}

// Sortable Card Component
function SortableCard({
  card, marcas, onEdit
}: {
  card: Encantamento; marcas: Marca[];
  onEdit: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const marcaNome = marcas.find(m => m.id === card.marca_id)?.nome || '—';
  const stageEntryDate = card._lastMoveAt || card.created_at;
  const daysInStage = daysSince(stageEntryDate);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '10px', padding: '0.85rem', cursor: 'grab',
        transition: 'box-shadow 0.2s, transform 0.15s',
        boxShadow: isDragging ? '0 8px 25px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div {...listeners} style={{ cursor: 'grab', color: 'var(--text-secondary)', marginTop: 2 }}>
            <GripVertical size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {card.cliente_nome}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                <Tag size={10} style={{ marginRight: 2 }} />{marcaNome}
              </span>
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                #{card.ticket_numero}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              <Clock size={11} />
              <span>Há {daysInStage} {daysInStage === 1 ? 'dia' : 'dias'} nesta etapa</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(card.id); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: 4, borderRadius: '4px', transition: 'background 0.15s' }}
            title="Editar"
          >
            <Edit3 size={15} />
          </button>
        </div>

        {card.status === 'agendados' && card.agendamento_data && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={11} />
            {new Date(card.agendamento_data + 'T00:00:00').toLocaleDateString('pt-BR')}
            {card.agendamento_horario && ` às ${card.agendamento_horario}`}
          </div>
        )}

        {card.valor_gasto > 0 && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <DollarSign size={11} />
            R$ {Number(card.valor_gasto).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

// Droppable Column
function KanbanColumn({
  column, cards, marcas, onEdit
}: {
  column: typeof COLUMNS[0]; cards: Encantamento[]; marcas: Marca[];
  onEdit: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div style={{
      minWidth: '280px', maxWidth: '320px', flex: '1 1 280px',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem', padding: '0.5rem 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: column.color }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{column.label}</span>
        </div>
        <span style={{
          background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '2px 8px',
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          {cards.length}
        </span>
      </div>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem',
          padding: '0.5rem', background: isOver ? 'rgba(139,92,246,0.06)' : 'var(--bg-primary)', borderRadius: '10px',
          border: isOver ? '2px dashed var(--accent-color)' : '1px dashed var(--border-color)',
          minHeight: '120px', overflowY: 'auto', transition: 'background 0.2s, border 0.2s',
        }}>
          {cards.map(card => (
            <SortableCard key={card.id} card={card} marcas={marcas} onEdit={onEdit} />
          ))}
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Nenhum card
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Main Page
export default function Encantamento() {
  const [cards, setCards] = useState<Encantamento[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [origens, setOrigens] = useState<Origem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'kanban' | 'dashboard'>('kanban');
  
  // Date filter: default to last 30 days
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // New card form
  const [form, setForm] = useState({
    cliente_nome: '', ticket_numero: '', telefone: '',
    marca_id: '', origem_id: '', motivo: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Filter encantamentos by created_at range
      let query = supabase.from('encantamentos').select('*');
      
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const [enc, marc, orig, hist] = await Promise.all([
        query.order('position'),
        supabase.from('marcas').select('*').order('nome'),
        supabase.from('origens').select('*').order('nome'),
        supabase.from('encantamentos_historico').select('*').order('moved_at', { ascending: false }),
      ]);

      const historyData: HistoryEntry[] = (hist.data || []) as any;
      setHistory(historyData);

      // Build a map: encantamento_id -> latest moved_at (the time it entered current stage)
      const lastMoveMap: Record<string, string> = {};
      for (const h of historyData) {
        const eid = h.encantamento_id;
        if (!lastMoveMap[eid]) {
          lastMoveMap[eid] = h.moved_at;
        }
      }

      const enriched = (enc.data || []).map((c: any) => ({
        ...c,
        _lastMoveAt: lastMoveMap[c.id] || c.created_at,
      }));

      setCards(enriched);
      setMarcas(marc.data || []);
      setOrigens(orig.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const columnCards = useMemo(() => {
    const grouped: Record<string, Encantamento[]> = {};
    COLUMNS.forEach(col => {
      let colCards = cards.filter(c => c.status === col.id);
      // Sort "agendados" by date asc
      if (col.id === 'agendados') {
        colCards.sort((a, b) => {
          const datetimeA = (a.agendamento_data || '9999-12-31') + (a.agendamento_horario || '23:59');
          const datetimeB = (b.agendamento_data || '9999-12-31') + (b.agendamento_horario || '23:59');
          return datetimeA.localeCompare(datetimeB);
        });
      }
      grouped[col.id] = colCards;
    });
    return grouped;
  }, [cards]);

  const stats = useMemo(() => {
    const totalEncantamentos = cards.length;
    const totalValor = cards.reduce((sum, c) => sum + (c.valor_gasto || 0), 0);

    const porMarca = marcas.map(m => {
      const brandCards = cards.filter(c => c.marca_id === m.id);
      return {
        name: m.nome,
        count: brandCards.length,
        value: brandCards.reduce((sum, c) => sum + (c.valor_gasto || 0), 0)
      };
    }).filter(m => m.count > 0).sort((a, b) => b.count - a.count);

    const porOrigem = origens.map(o => {
      const originCards = cards.filter(c => c.origem_id === o.id);
      return {
        name: o.nome,
        count: originCards.length
      };
    }).filter(o => o.count > 0).sort((a, b) => b.count - a.count);

    // Evolution by day
    const dayMap: Record<string, { date: string; count: number; value: number; [key: string]: any }> = {};
    cards.forEach(c => {
      const day = c.created_at.split('T')[0];
      const brandName = marcas.find(m => m.id === c.marca_id)?.nome || 'Outros';
      
      if (!dayMap[day]) {
        dayMap[day] = { date: format(parseISO(day), 'dd/MM'), count: 0, value: 0 };
      }
      dayMap[day].count++;
      dayMap[day].value += (c.valor_gasto || 0);
      dayMap[day][brandName] = (dayMap[day][brandName] || 0) + 1;
    });
    const evolução = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // Time metrics
    const concluídos = cards.filter(c => c.status === 'concluido' && c.completed_at);
    
    const calculateAvgDays = (items: any[], startField: 'created_at' | string, endField: 'completed_at') => {
      if (items.length === 0) return 0;
      const totalDays = items.reduce((sum, c) => {
        const start = new Date(c[startField]).getTime();
        const end = new Date(c[endField]).getTime();
        return sum + (end - start);
      }, 0);
      return Math.round(totalDays / items.length / (1000 * 60 * 60 * 24));
    };

    // For step-based averages, we need to find the entry date for each step in history
    const getStepEntry = (cardId: string, stepId: string, createdAt: string) => {
      if (stepId === 'backlog') return createdAt;
      const entry = history.find(h => h.encantamento_id === cardId && h.etapa_nova === stepId);
      return entry ? entry.moved_at : null;
    };

    const avgTotal = calculateAvgDays(concluídos, 'created_at', 'completed_at');
    
    const avgTimes = {
      total: avgTotal,
      em_contato: 0,
      planejamento: 0,
      agendado: 0,
      em_andamento: 0
    };

    ['em_contato', 'planejamento', 'agendados', 'em_andamento'].forEach(step => {
      const valid = concluídos.map(c => {
        const entry = getStepEntry(c.id, step === 'agendados' ? 'agendados' : step, c.created_at);
        return entry ? { ...c, entry_at: entry } : null;
      }).filter(Boolean) as any[];
      
      if (valid.length > 0) {
        const total = valid.reduce((sum, c) => sum + (new Date(c.completed_at).getTime() - new Date(c.entry_at).getTime()), 0);
        (avgTimes as any)[step === 'agendados' ? 'agendado' : step] = Math.round(total / valid.length / (1000 * 60 * 60 * 24));
      }
    });

    // Time per column (average stay)
    const timePerColumn = COLUMNS.map(col => {
      // Find all durations in this column
      let totalMs = 0;
      let count = 0;

      cards.forEach(c => {
        const cardHistory = history.filter(h => h.encantamento_id === c.id).sort((a, b) => a.moved_at.localeCompare(b.moved_at));
        
        let entryTime = new Date(c.created_at).getTime();
        let currentStatus = 'backlog';

        // Traverse history to find intervals
        for (const h of cardHistory) {
          if (currentStatus === col.id) {
            totalMs += (new Date(h.moved_at).getTime() - entryTime);
            count++;
          }
          currentStatus = h.etapa_nova;
          entryTime = new Date(h.moved_at).getTime();
        }

        // Add current status duration if it matches and it's not concluded
        if (currentStatus === col.id && currentStatus !== 'concluido') {
          totalMs += (new Date().getTime() - entryTime);
          count++;
        }
      });

      return {
        name: col.label,
        avgDays: count > 0 ? Math.round(totalMs / count / (1000 * 60 * 60 * 24)) : 0
      };
    });

    return {
      totalEncantamentos,
      totalValor,
      porMarca,
      porOrigem,
      evolução,
      avgTimes,
      timePerColumn
    };
  }, [cards, history, marcas, origens]);

  const handleCreateCard = async () => {
    if (!form.cliente_nome || !form.ticket_numero || !form.telefone) {
      setFeedback({ type: 'error', message: 'Preencha os campos obrigatórios.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('encantamentos').insert({
        cliente_nome: form.cliente_nome,
        ticket_numero: form.ticket_numero,
        telefone: form.telefone,
        marca_id: form.marca_id || null,
        origem_id: form.origem_id || null,
        motivo: form.motivo,
        status: 'backlog',
        position: cards.length,
      });
      if (error) throw error;

      setForm({ cliente_nome: '', ticket_numero: '', telefone: '', marca_id: '', origem_id: '', motivo: '' });
      setShowForm(false);
      setFeedback({ type: 'success', message: 'Encantamento criado!' });
      setTimeout(() => setFeedback(null), 3000);
      fetchAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao criar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    const overCard = cards.find(c => c.id === over.id);
    const isColumn = COLUMNS.some(col => col.id === over.id);

    // If over a card in a different column
    if (overCard && activeCard.status !== overCard.status) {
      setCards(prev => prev.map(c =>
        c.id === activeCard.id ? { ...c, status: overCard.status } : c
      ));
    }
    // If over a column droppable directly (empty column)
    else if (isColumn && activeCard.status !== over.id) {
      setCards(prev => prev.map(c =>
        c.id === activeCard.id ? { ...c, status: over.id as string } : c
      ));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    // Determine the target column
    let targetStatus = activeCard.status;
    const overCard = cards.find(c => c.id === over.id);
    if (overCard) {
      targetStatus = overCard.status;
    }
    // Check if dropped on a column id directly
    const isColumn = COLUMNS.some(col => col.id === over.id);
    if (isColumn) {
      targetStatus = over.id as string;
    }

    const originalCard = (await supabase.from('encantamentos').select('status').eq('id', activeCard.id).single()).data;
    const previousStatus = originalCard?.status || activeCard.status;

    if (previousStatus !== targetStatus) {
      // Update status in DB
      const updatePayload: any = { status: targetStatus };
      if (targetStatus === 'concluido') {
        updatePayload.completed_at = new Date().toISOString();
      }
      await supabase.from('encantamentos').update(updatePayload).eq('id', activeCard.id);

      // Record movement in history
      await supabase.from('encantamentos_historico').insert({
        encantamento_id: activeCard.id,
        etapa_anterior: previousStatus,
        etapa_nova: targetStatus,
      });

      setCards(prev => prev.map(c =>
        c.id === activeCard.id ? { 
          ...c, 
          status: targetStatus, 
          _lastMoveAt: new Date().toISOString(),
          ...(targetStatus === 'concluido' ? { completed_at: new Date().toISOString() } : {}) 
        } : c
      ));

      const newColumnLabel = COLUMNS.find(col => col.id === targetStatus)?.label || targetStatus;
      setFeedback({ type: 'success', message: `Status de "${activeCard.cliente_nome}" atualizado para "${newColumnLabel}"!` });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const openEditDrawer = (id: string) => {
    setEditingCardId(id);
  };

  const handleDrawerSave = useCallback(async (id: string, updates: Partial<Encantamento>) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;

    // Change detection: compare updates with current card
    const hasChanges = Object.keys(updates).some(key => {
      const k = key as keyof Encantamento;
      return updates[k] !== card[k];
    });

    if (!hasChanges) {
      setFeedback({ type: 'success', message: 'Nenhuma alteração detectada.' });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    const previousStatus = card.status;
    const newStatus = updates.status || previousStatus;
    const payload: any = { ...updates };
    delete payload._lastMoveAt;
    delete payload.id;
    delete payload.created_at;

    if (newStatus === 'concluido' && previousStatus !== 'concluido') {
      payload.completed_at = new Date().toISOString();
    }

    // Optimistic update
    setCards(prev => prev.map(c => c.id === id ? { 
      ...c, 
      ...updates,
      ...(newStatus !== previousStatus ? { _lastMoveAt: new Date().toISOString() } : {}),
      ...(newStatus === 'concluido' && previousStatus !== 'concluido' ? { completed_at: payload.completed_at } : {})
    } : c));

    try {
      await supabase.from('encantamentos').update(payload).eq('id', id);

      // Record history if status changed
      if (previousStatus !== newStatus) {
        await supabase.from('encantamentos_historico').insert({
          encantamento_id: id,
          etapa_anterior: previousStatus,
          etapa_nova: newStatus,
        });
      }

      setFeedback({ type: 'success', message: 'Alterações salvas com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
      
      // Sync in background without full reload flickering
      const { data } = await supabase.from('encantamentos').select('*').eq('id', id).single();
      if (data) {
        setCards(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Erro ao salvar alterações.' });
      setTimeout(() => setFeedback(null), 3000);
      fetchAll(); // Rollback/Resync on error
    }
  }, [cards, fetchAll]);

  const activeCard = activeId ? cards.find(c => c.id === activeId) : null;
  const editingCard = editingCardId ? cards.find(c => c.id === editingCardId) || null : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-color)" />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={28} color="var(--accent-color)" />
            Encantamento
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Acompanhe o fluxo operacional de encantamentos do time.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'kanban' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Cancelar' : 'Novo Encantamento'}
            </button>
          )}
        </div>
      </header>

      {/* Tabs and Filters */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', 
        paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('kanban')}
            style={{
              padding: '0.5rem 1rem', background: 'none', border: 'none',
              color: activeTab === 'kanban' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: 600, borderBottom: activeTab === 'kanban' ? '2px solid var(--accent-color)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <KanbanIcon size={18} /> Gestão (Kanban)
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '0.5rem 1rem', background: 'none', border: 'none',
              color: activeTab === 'dashboard' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: 600, borderBottom: activeTab === 'dashboard' ? '2px solid var(--accent-color)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Filter size={14} color="var(--text-secondary)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="date" className="form-input" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', width: 'auto' }} 
              value={startDate} onChange={e => setStartDate(e.target.value)} 
            />
            <ArrowRight size={14} color="var(--text-secondary)" />
            <input 
              type="date" className="form-input" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', width: 'auto' }} 
              value={endDate} onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          fontSize: '0.95rem',
          fontWeight: 500,
          background: 'var(--bg-secondary)',
          color: feedback.type === 'success' ? '#10B981' : '#EF4444',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          animation: 'toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {feedback.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {feedback.message}
          <button 
            onClick={() => setFeedback(null)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: '0.5rem', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { transform: translateY(100%) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

      {/* Tab Content */}
      {activeTab === 'kanban' ? (
        <>
          {/* New Card Form */}
          {showForm && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--accent-color)" /> Novo Encantamento
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome do Cliente *</label>
                  <input type="text" className="form-input" value={form.cliente_nome} onChange={e => setForm(p => ({ ...p, cliente_nome: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nº do Ticket *</label>
                  <input type="text" className="form-input" value={form.ticket_numero} onChange={e => setForm(p => ({ ...p, ticket_numero: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Telefone *</label>
                  <input type="text" className="form-input" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Marca</label>
                  <select className="form-input" value={form.marca_id} onChange={e => setForm(p => ({ ...p, marca_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Origem</label>
                  <select className="form-input" value={form.origem_id} onChange={e => setForm(p => ({ ...p, origem_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {origens.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                <label className="form-label">Motivo do Encantamento</label>
                <textarea className="form-input" rows={3} value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  onClick={handleCreateCard}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Criar Encantamento
                </button>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div style={{
              display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem',
              minHeight: 'calc(100vh - 280px)',
            }}>
              {COLUMNS.map(col => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  cards={columnCards[col.id] || []}
                  marcas={marcas}
                  onEdit={openEditDrawer}
                />
              ))}
            </div>

            <DragOverlay>
              {activeCard && (
                <div style={{
                  background: 'var(--bg-secondary)', border: '2px solid var(--accent-color)',
                  borderRadius: '10px', padding: '0.85rem', boxShadow: '0 12px 35px rgba(0,0,0,0.35)',
                  maxWidth: '300px', transform: 'rotate(3deg)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {activeCard.cliente_nome}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    #{activeCard.ticket_numero}
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </>
      ) : (
        <DashboardView stats={stats} cards={cards} marcas={marcas} origens={origens} />
      )}

      {/* Edit Drawer */}
      {editingCard && (
        <EditDrawer
          card={editingCard}
          marcas={marcas}
          origens={origens}
          onClose={() => setEditingCardId(null)}
          onSave={handleDrawerSave}
        />
      )}
    </div>
  );
}

// ===================== EDIT DRAWER =====================
function EditDrawer({
  card, marcas, origens, onClose, onSave
}: {
  card: Encantamento; marcas: Marca[]; origens: Origem[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<Encantamento>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Encantamento>({ ...card });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({ ...card });
  }, [card]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft.id, {
        cliente_nome: draft.cliente_nome,
        ticket_numero: draft.ticket_numero,
        telefone: draft.telefone,
        marca_id: draft.marca_id || null,
        origem_id: draft.origem_id || null,
        motivo: draft.motivo,
        status: draft.status,
        observacoes_cliente: draft.observacoes_cliente || null,
        planejamento_descricao: draft.planejamento_descricao || null,
        planejamento_itens: draft.planejamento_itens || null,
        planejamento_experiencia: draft.planejamento_experiencia || null,
        valor_gasto: draft.valor_gasto || 0,
        agendamento_data: draft.agendamento_data || null,
        agendamento_horario: draft.agendamento_horario || null,
        endereco_completo: draft.endereco_completo || null,
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (text: string) => (
    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
      {text}
    </h3>
  );

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 999, backdropFilter: 'blur(2px)',
          animation: 'drawerOverlayIn 0.25s ease',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '40vw', minWidth: '380px', maxWidth: '650px',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        zIndex: 1000, display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.3)',
        animation: 'drawerSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
          minHeight: '64px',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Edit3 size={20} color="var(--accent-color)" /> Editar Encantamento
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {sectionTitle('📌 Dados Básicos')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ticket</label>
              <input type="text" className="form-input" value={draft.ticket_numero} onChange={e => setDraft(p => ({ ...p, ticket_numero: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Telefone</label>
              <input type="text" className="form-input" value={draft.telefone} onChange={e => setDraft(p => ({ ...p, telefone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <label className="form-label">Nome do Cliente</label>
            <input type="text" className="form-input" value={draft.cliente_nome} onChange={e => setDraft(p => ({ ...p, cliente_nome: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Marca</label>
              <select className="form-input" value={draft.marca_id || ''} onChange={e => setDraft(p => ({ ...p, marca_id: e.target.value || null }))}>
                <option value="">Selecione...</option>
                {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Origem</label>
              <select className="form-input" value={draft.origem_id || ''} onChange={e => setDraft(p => ({ ...p, origem_id: e.target.value || null }))}>
                <option value="">Selecione...</option>
                {origens.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <textarea className="form-input" rows={2} value={draft.motivo || ''} onChange={e => setDraft(p => ({ ...p, motivo: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <label className="form-label">Status Atual</label>
            <select className="form-input" value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {sectionTitle('📝 Observações / Perfil do Cliente')}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Gostos, hobbies, família, rotina, preferências...
            </label>
            <textarea
              className="form-input"
              rows={5}
              placeholder="Ex: Cliente gosta de sair com os filhos, costuma pedir aos finais de semana..."
              value={draft.observacoes_cliente || ''}
              onChange={e => setDraft(p => ({ ...p, observacoes_cliente: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          {sectionTitle('🎯 Planejamento do Encantamento')}
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Descrição do planejamento</label>
            <textarea className="form-input" rows={3} placeholder="Ideia, estratégia, contexto..." value={draft.planejamento_descricao || ''} onChange={e => setDraft(p => ({ ...p, planejamento_descricao: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Itens de compra</label>
            <textarea className="form-input" rows={2} placeholder="Presentes, brindes, ingressos..." value={draft.planejamento_itens || ''} onChange={e => setDraft(p => ({ ...p, planejamento_itens: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Experiência planejada</label>
            <textarea className="form-input" rows={2} placeholder="Ex: Enviar pedido + ingresso do parque..." value={draft.planejamento_experiencia || ''} onChange={e => setDraft(p => ({ ...p, planejamento_experiencia: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          {sectionTitle('💰 Valor Gasto')}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Valor total (R$)</label>
            <input type="number" step="0.01" min="0" className="form-input" value={draft.valor_gasto || ''} onChange={e => setDraft(p => ({ ...p, valor_gasto: parseFloat(e.target.value) || 0 }))} />
          </div>

          {sectionTitle('📅 Agendamento')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={draft.agendamento_data || ''} onChange={e => setDraft(p => ({ ...p, agendamento_data: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Horário</label>
              <input type="time" className="form-input" value={draft.agendamento_horario || ''} onChange={e => setDraft(p => ({ ...p, agendamento_horario: e.target.value }))} />
            </div>
          </div>

          {sectionTitle('📍 Endereço Completo')}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Logística de entrega ou evento
            </label>
            <textarea 
              className="form-input" 
              rows={4} 
              placeholder="Rua, número, complemento, bairro, cidade, CEP e referência." 
              value={draft.endereco_completo || ''} 
              onChange={e => setDraft(p => ({ ...p, endereco_completo: e.target.value }))} 
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes drawerOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ===================== DASHBOARD COMPONENTS =====================
function MetricCard({ title, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
      <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${color}15`, color: color }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{title}</div>
        <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0.2rem 0' }}>{value}</div>
        {subtitle && <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function DashboardView({ stats, cards, marcas, origens }: any) {
  const brandColors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease' }}>
      
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <MetricCard title="Total de Encantamentos" value={stats.totalEncantamentos} icon={Sparkles} color="#8B5CF6" />
        <MetricCard title="Valor Total Gasto" value={`R$ ${stats.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="#10B981" />
        <MetricCard title="Média por Encantamento" value={`R$ ${(stats.totalValor / (stats.totalEncantamentos || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="#3B82F6" />
        <MetricCard title="Tempo Médio (Total)" value={`${stats.avgTimes.total} dias`} icon={Clock} color="#F59E0B" subtitle="Backlog até Conclusão" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="var(--accent-color)" /> Evolução de Encantamentos
          </h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolução}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="count" name="Encantamentos" stroke="var(--accent-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={18} color="#10B981" /> Evolução de Valor Gasto
          </h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.evolução}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Gasto']}
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" name="Valor Gasto" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Brand Evolution Row */}
      <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={18} color="var(--accent-color)" /> Evolução por Marca
        </h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.evolução}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
              <Legend iconType="circle" />
              {stats.porMarca.slice(0, 5).map((m: any, idx: number) => (
                <Line 
                  key={m.name} type="monotone" dataKey={(d: any) => {
                    // This requires building the evolution data with brand keys
                    return d[m.name] || 0;
                  }} 
                  name={m.name} stroke={brandColors[idx % brandColors.length]} strokeWidth={2} dot={false} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution and Time Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Brand/Origin Distribution */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Distribuição por Marca</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.porMarca.map((m: any, idx: number) => (
              <div key={m.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.count} ({((m.count / stats.totalEncantamentos) * 100).toFixed(0)}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(m.count / stats.totalEncantamentos) * 100}%`, background: brandColors[idx % brandColors.length] }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>R$ {m.value.toLocaleString('pt-BR')} total</div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', marginTop: '2rem' }}>Origem dos Casos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.porOrigem.map((o: any) => (
              <div key={o.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>{o.name}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)' }}>{o.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time Metrics Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--accent-color)" /> Tempo Médio para Conclusão
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contato → Fim</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.avgTimes.em_contato} dias</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Planejado → Fim</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.avgTimes.planejamento} dias</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Agendado → Fim</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.avgTimes.agendado} dias</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Execução → Fim</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.avgTimes.em_andamento} dias</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Permanência Média por Etapa</h3>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.timePerColumn} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                  <Bar dataKey="avgDays" name="Dias" fill="var(--accent-color)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Listagem Detalhada</h3>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {['Ticket', 'Cliente', 'Marca', 'Origem', 'Status', 'Valor', 'Data'].map(h => (
                  <th key={h} style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>#{c.ticket_numero}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{c.cliente_nome}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#A78BFA' }}>
                      {marcas.find((m: any) => m.id === c.marca_id)?.nome || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {origens.find((o: any) => o.id === c.origem_id)?.nome || '—'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', 
                      background: `${COLUMNS.find(col => col.id === c.status)?.color}15`, 
                      color: COLUMNS.find(col => col.id === c.status)?.color 
                    }}>
                      {COLUMNS.find(col => col.id === c.status)?.label}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, color: '#10B981' }}>
                    R$ {(c.valor_gasto || 0).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {format(parseISO(c.created_at), 'dd/MM/yyyy')}
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum registro encontrado no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .table-row-hover:hover { background: rgba(255,255,255,0.02); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
