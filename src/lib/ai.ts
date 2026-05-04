export interface AIConfig {
  provider: string;
  api_key: string;
  modelo: string;
  temperatura: number;
  prompt: string;
}

export interface AnalysisResult {
  nota_final: number;
  marcas: string[];
  diagnostico: string;
  pontos_fortes: string[];
  erros: string[];
  sugestoes: string[];
  criterios: Array<{
    nome: string;
    nota: number;
    justificativa: string;
    exemplo: string;
  }>;
  coach?: {
    foco: string;
    correcao_erro: string;
    correcao_acerto: string;
    desafio: string;
  };
}

export interface TeamCoachResult {
  foco: string;
  esperamos: string;
  desafio: string;
}

const SYSTEM_PROMPT_WRAPPER = `
Você é um Analista de Qualidade Especialista em Zendesk.
Sua missão é analisar os tickets fornecidos e aplicar ESTRITAMENTE as regras de QA abaixo.

REGRAS E BASE DE CONHECIMENTO:
{USER_PROMPT}

INSTRUÇÕES DE SAÍDA:
Você DEVE retornar APENAS um JSON válido, sem markdown (\`\`\`json), sem explicações extras. O JSON deve ter EXATAMENTE esta estrutura:
{
  "nota_final": 4.5,
  "marcas": ["Marca A", "Marca B"],
  "diagnostico": "Resumo geral do atendimento",
  "pontos_fortes": ["Ponto 1", "Ponto 2"],
  "erros": ["Erro 1", "Erro 2"],
  "sugestoes": ["Sugestão 1", "Sugestão 2"],
  "criterios": [
    {
      "nome": "Abertura",
      "nota": 5,
      "justificativa": "Motivo da nota",
      "exemplo": "Trecho da conversa"
    }
  ],
  "coach": {
    "foco": "Escuta ativa + clareza no discurso",
    "correcao_erro": "O que foi feito de errado",
    "correcao_acerto": "Como deveria ter sido falado",
    "desafio": "Micro tarefa para os próximos atendimentos"
  }
}
`;

export async function analyzeTickets(config: AIConfig, tickets: string[], playbookContent?: string): Promise<AnalysisResult> {
  const combinedTickets = tickets.map((t, i) => `--- TICKET ${i + 1} ---\n${t}\n-------------------`).join('\n\n');
  
  // Monta o contexto de regras: prompt do usuário + conteúdo do playbook da Base de Conhecimento
  let fullRules = config.prompt || '';
  if (playbookContent && playbookContent.trim().length > 0) {
    fullRules += `\n\n--- PLAYBOOK DE ATENDIMENTO (BASE DE CONHECIMENTO) ---\n${playbookContent}\n--- FIM DO PLAYBOOK ---`;
  }

  const systemPrompt = SYSTEM_PROMPT_WRAPPER.replace('{USER_PROMPT}', fullRules);
  const userContent = `Por favor, analise as seguintes conversas de ticket:\n\n${combinedTickets}`;

  if (config.provider === 'openai') {
    return callOpenAI(config, systemPrompt, userContent);
  } else if (config.provider === 'google') {
    return callGemini(config, systemPrompt, userContent);
  } else {
    throw new Error('Provedor não implementado ou não suportado ainda.');
  }
}

async function callOpenAI(config: AIConfig, systemPrompt: string, userContent: string): Promise<AnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.modelo || 'gpt-4o',
      temperature: config.temperatura,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erro na API da OpenAI');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

async function callGemini(config: AIConfig, systemPrompt: string, userContent: string): Promise<AnalysisResult> {
  // Config Gemini API URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelo || 'gemini-1.5-pro'}:generateContent?key=${config.api_key}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userContent }]
      }],
      generationConfig: {
        temperature: config.temperatura,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erro na API do Google Gemini');
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : content);
}

export async function generateTeamCoach(config: AIConfig, metricsText: string): Promise<TeamCoachResult> {
  const systemPrompt = `Você é um Líder de Qualidade de Atendimento (QA).
Foi solicitado que você gere um plano de ação e treinamento DIRETO e RÁPIDO para a EQUIPE INTEIRA com base no desempenho do time.
O usuário vai te passar as médias do time nos critérios de avaliação e o ranking.
Você deve retornar APENAS um objeto JSON válido, sem formatação markdown. 
O JSON deve ter EXATAMENTE esta estrutura:
{
  "foco": "Onde o time todo precisa focar nesta semana (ex: 'Melhorar a identificação do cliente e empatia nas respostas.')",
  "esperamos": "O que esperamos como padrão de excelência nestes pontos críticos.",
  "desafio": "Uma micro-tarefa comportamental ou desafio prático para todo o time nos próximos atendimentos."
}
Não adicione NENHUM outro campo.`;

  if (config.provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.api_key}` },
      body: JSON.stringify({
        model: config.modelo || 'gpt-4o',
        temperature: config.temperatura,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: metricsText }
        ]
      })
    });
    if (!response.ok) throw new Error('Erro na API da OpenAI');
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } else if (config.provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelo || 'gemini-1.5-pro'}:generateContent?key=${config.api_key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: metricsText }] }],
        generationConfig: { temperature: config.temperatura, responseMimeType: "application/json" }
      })
    });
    if (!response.ok) throw new Error('Erro na API do Google Gemini');
    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } else {
    throw new Error('Provedor não implementado.');
  }
}
