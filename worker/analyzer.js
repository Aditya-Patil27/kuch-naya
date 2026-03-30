const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 10000);

function stripJsonFences(text) {
  return String(text || '')
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function parseJsonLike(text) {
  const cleaned = stripJsonFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Analyzer response is not valid JSON');
  }
}

function buildPrompt(payload) {
  const diff = String(payload.diffText || '').slice(0, 3000);
  return [
    'You are a performance analysis tool.',
    'Respond ONLY with valid JSON object and no extra text.',
    'Required keys: severity, file, lines, mechanism, suggestedFix, confidence, summary.',
    '',
    `Verdict: ${payload.verdict}`,
    `P99 baseline: ${payload.baseline.p99}ms`,
    `P99 chaos: ${payload.chaos.p99}ms`,
    `P99 delta: ${payload.p99DeltaPct.toFixed(2)}%`,
    '',
    'Diff (truncated):',
    diff,
  ].join('\n');
}

async function analyzeWithOllama(prompt) {
  const endpoint = `${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`;
  const model = process.env.OLLAMA_MODEL || 'qwen3:8b';

  let timeoutHandle;
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Ollama timeout')), OLLAMA_TIMEOUT_MS);
  });

  const request = fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Ollama failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    return parseJsonLike(data.response);
  });

  try {
    const parsed = await Promise.race([request, timeout]);
    return { ...parsed, provider: 'ollama' };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function analyzeWithGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

  const endpoint = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
  const model = process.env.GROQ_MODEL || 'qwen-qwq-32b';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content:
            'You are a performance analysis tool. Respond with only a valid JSON object. No prose.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = parseJsonLike(content);
  return { ...parsed, provider: 'groq' };
}

function fallbackAnalysis(payload) {
  return {
    severity: payload.verdict === 'BLOCK' ? 'CRITICAL' : payload.verdict === 'WARN' ? 'HIGH' : 'LOW',
    file: 'unknown',
    lines: 'n/a',
    mechanism: 'Automated analysis unavailable; relying on measured performance metrics.',
    suggestedFix:
      'Review hot-path queries and network behavior, then rerun baseline vs chaos to validate improvements.',
    confidence: 'LOW',
    summary: `Performance verdict ${payload.verdict}. P99 delta ${payload.p99DeltaPct.toFixed(2)}%.`,
    provider: 'fallback',
  };
}

async function analyze(payload) {
  const provider = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  const prompt = buildPrompt(payload);

  if (provider === 'groq') {
    try {
      return await analyzeWithGroq(prompt);
    } catch (error) {
      console.error('[analyzer] groq failed:', error.message);
      return fallbackAnalysis(payload);
    }
  }

  if (provider === 'ollama') {
    try {
      return await analyzeWithOllama(prompt);
    } catch (error) {
      console.error('[analyzer] ollama failed:', error.message);
      return fallbackAnalysis(payload);
    }
  }

  try {
    return await analyzeWithOllama(prompt);
  } catch (ollamaError) {
    console.error('[analyzer] ollama failed in auto mode:', ollamaError.message);
    try {
      return await analyzeWithGroq(prompt);
    } catch (groqError) {
      console.error('[analyzer] groq failed in auto mode:', groqError.message);
      return fallbackAnalysis(payload);
    }
  }
}

module.exports = { analyze };
