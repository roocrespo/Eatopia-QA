import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  UploadCloud, FileText, Trash2, CheckCircle, Download,
  Loader2, AlertCircle, BookOpen, RefreshCw
} from 'lucide-react';

interface KnowledgeFile {
  id: string;
  nome_arquivo: string;
  url: string;
  tamanho: number;
  tipo: string;
  conteudo_texto: string | null;
  created_at: string;
}

export default function KnowledgeBase() {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('base_conhecimento')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      setError('Erro ao carregar arquivos: ' + err.message);
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFiles = async (newFiles: File[]) => {
    setUploading(true);
    setError(null);

    for (const file of newFiles) {
      const MAX_SIZE = 20 * 1024 * 1024; // 20MB
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" excede o limite de 20MB.`);
        continue;
      }

      const allowed = ['.pdf', '.docx', '.txt'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowed.includes(ext)) {
        setError(`Tipo de arquivo não suportado: ${file.name}. Use PDF, DOCX ou TXT.`);
        continue;
      }

      try {
        console.log('[KnowledgeBase] Iniciando upload de:', file.name, 'tamanho:', file.size, 'tipo:', file.type);
        
        // 1. Upload para o Storage
        const storagePath = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        console.log('[KnowledgeBase] Storage path:', storagePath);
        
        // Definir content-type explicitamente
        const contentType = file.type || (
          ext === '.txt' ? 'text/plain' :
          ext === '.pdf' ? 'application/pdf' :
          ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          'application/octet-stream'
        );

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('playbook')
          .upload(storagePath, file, { 
            upsert: false,
            contentType,
          });

        console.log('[KnowledgeBase] Upload result:', JSON.stringify({ uploadData, uploadErr }));

        if (uploadErr) {
          console.error('[KnowledgeBase] Upload error details:', JSON.stringify(uploadErr));
          throw new Error('Erro no upload ao Storage: ' + uploadErr.message);
        }

        // 2. Extrair texto (para .txt — lido diretamente pela IA)
        let conteudoTexto: string | null = null;
        if (ext === '.txt') {
          conteudoTexto = await file.text();
          console.log('[KnowledgeBase] Texto extraído, tamanho:', conteudoTexto.length);
        }

        // 3. Salvar metadados no banco
        const { data: dbData, error: dbErr } = await supabase.from('base_conhecimento').insert({
          nome_arquivo: file.name,
          url: storagePath,
          tamanho: file.size,
          tipo: contentType,
          conteudo_texto: conteudoTexto,
        }).select();

        console.log('[KnowledgeBase] DB insert result:', JSON.stringify({ dbData, dbErr }));

        if (dbErr) {
          console.error('[KnowledgeBase] DB error details:', JSON.stringify(dbErr));
          throw new Error('Erro ao salvar no banco: ' + dbErr.message);
        }

        showSuccess(`"${file.name}" enviado com sucesso!`);
      } catch (e: any) {
        console.error('[KnowledgeBase] ERRO COMPLETO:', e);
        setError(e.message || 'Erro desconhecido no upload. Verifique o console para mais detalhes.');
      }
    }

    await loadFiles();
    setUploading(false);
  };

  const handleDownload = async (file: KnowledgeFile) => {
    try {
      const { data, error: err } = await supabase.storage
        .from('playbook')
        .createSignedUrl(file.url, 60); // URL válida por 60 segundos para download

      if (err || !data?.signedUrl) throw new Error('Erro ao gerar link de download');

      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = file.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (file: KnowledgeFile) => {
    if (!confirm(`Deseja remover "${file.nome_arquivo}"?`)) return;
    setError(null);

    try {
      // 1. Remover do Storage
      const { error: storageErr } = await supabase.storage
        .from('playbook')
        .remove([file.url]);

      if (storageErr) console.warn('Aviso ao remover do storage:', storageErr.message);

      // 2. Remover do banco
      const { error: dbErr } = await supabase
        .from('base_conhecimento')
        .delete()
        .eq('id', file.id);

      if (dbErr) throw new Error('Erro ao remover do banco: ' + dbErr.message);

      setFiles(prev => prev.filter(f => f.id !== file.id));
      showSuccess(`"${file.nome_arquivo}" removido.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Base de Conhecimento</h1>
        <button
          onClick={loadFiles}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          title="Recarregar lista"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Faça o upload do Playbook de Atendimento, tom de voz e regras da empresa.<br />
        <strong style={{ color: 'var(--text-primary)' }}>Os arquivos são salvos permanentemente</strong> e a IA os utilizará como contexto nas análises de tickets.
        <br />
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>
          💡 Dica: Arquivos <strong>.TXT</strong> têm o conteúdo lido diretamente pela IA. PDF e DOCX ficam disponíveis para download e referência.
        </span>
      </p>

      {/* Mensagens de feedback */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: '1.5rem', color: '#EF4444' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, marginBottom: '1.5rem', color: '#10B981' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Drop Zone */}
      <div
        className="card"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed var(--accent-color)' : '2px dashed var(--border-color)',
          backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          textAlign: 'center',
          transition: 'all 0.2s',
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.7 : 1,
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem', color: 'var(--accent-color)' }}>
          {uploading ? <Loader2 size={32} className="spinner" /> : <UploadCloud size={32} />}
        </div>
        <h3 style={{ marginBottom: '0.5rem' }}>
          {uploading ? 'Enviando arquivo...' : 'Clique ou arraste arquivos aqui'}
        </h3>
        <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--text-secondary)' }}>
          Suporta PDF, DOCX, TXT (Máx. 20MB)
        </p>
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileInput}
          disabled={uploading}
        />
        {!uploading && (
          <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Selecionar Arquivos
          </button>
        )}
      </div>

      {/* Lista de arquivos */}
      <div style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ margin: 0 }}>
            Playbooks Salvos
            {files.length > 0 && (
              <span style={{ marginLeft: '0.5rem', backgroundColor: 'var(--accent-color)', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>
                {files.length}
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: 'var(--text-secondary)' }}>
            <Loader2 size={20} className="spinner" /> Carregando arquivos...
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <FileText size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ margin: 0 }}>Nenhum arquivo enviado ainda.<br />Faça o upload do seu Playbook acima.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {files.map(file => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--accent-color)', flexShrink: 0 }}>
                    <FileText size={24} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.nome_arquivo}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {formatSize(file.tamanho)} &nbsp;•&nbsp; Enviado em {formatDate(file.created_at)}
                      {file.conteudo_texto && (
                        <span style={{ marginLeft: '0.5rem', color: '#10B981', fontWeight: 600 }}>
                          ✓ Conteúdo lido pela IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                    <CheckCircle size={14} /> Salvo
                  </div>
                  <button
                    onClick={() => handleDownload(file)}
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    title="Download"
                  >
                    <Download size={14} /> Baixar
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: 8, display: 'flex', alignItems: 'center' }}
                    title="Remover arquivo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
