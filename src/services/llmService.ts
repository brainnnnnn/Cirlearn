export interface LLMCallOptions {
  baseURL?: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  timeout?: number;
}

export async function callLLM(options: LLMCallOptions): Promise<Response> {
  const {
    baseURL,
    apiKey,
    model,
    messages,
    temperature = 0.7,
    stream = false,
    maxTokens,
    timeout = 180_000,
  } = options;

  const resolvedBaseURL = resolveBaseURL(baseURL, apiKey);
  const isAnthropic = !baseURL && apiKey.startsWith('sk-ant-');
  const isGoogle = !baseURL && apiKey.startsWith('AIza');

  if (isAnthropic) {
    return callAnthropic({ apiKey, model, messages, temperature, stream, maxTokens, timeout });
  }

  if (isGoogle) {
    return callGoogleOpenAI({ apiKey, model, messages, temperature, stream, maxTokens, timeout }, resolvedBaseURL);
  }

  return callOpenAICompatible({
    baseURL: resolvedBaseURL,
    apiKey,
    model,
    messages,
    temperature,
    stream,
    maxTokens,
    timeout,
  });
}

function resolveBaseURL(baseURL: string | undefined, apiKey: string): string {
  if (baseURL) return baseURL;
  if (apiKey.startsWith('sk-ant-')) return 'https://api.anthropic.com/v1';
  if (apiKey.startsWith('AIza')) return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (apiKey.startsWith('sk-')) return 'https://api.moonshot.cn/v1';
  return 'https://api.openai.com/v1';
}

async function callOpenAICompatible(options: LLMCallOptions & { baseURL: string }): Promise<Response> {
  const {
    apiKey,
    model,
    messages,
    temperature,
    stream,
    maxTokens,
    timeout = 180_000,
    baseURL,
  } = options;
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream,
  };
  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
}

async function callAnthropic(options: LLMCallOptions): Promise<Response> {
  const { apiKey, model, messages, temperature, stream, maxTokens, timeout = 180_000 } = options;
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const userMessages = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens ?? 4096,
    temperature,
    system: systemMessage,
    messages: userMessages,
    stream,
  };

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
}

async function callGoogleOpenAI(options: LLMCallOptions, baseURL: string): Promise<Response> {
  const { apiKey, model, messages, temperature, stream, maxTokens, timeout = 180_000 } = options;
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream,
  };
  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
}
