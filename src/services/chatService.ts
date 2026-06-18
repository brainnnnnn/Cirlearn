import { ChatRequest, Subject, QuestionType } from '@/types';
import { detectSubject } from '@/lib/subjectDetector';
import { MATH_SYSTEM_PROMPT, CHINESE_SYSTEM_PROMPT, ENGLISH_SYSTEM_PROMPT } from '@/lib/prompts/prompts';
import { callLLM } from './llmService';

const DEFAULT_MODEL = 'moonshot-v1-8k';
const FETCH_TIMEOUT_MS = 180_000;

export function resolveSubject(request: ChatRequest): Subject {
  return request.subjectOverride ?? detectSubject(request.messages);
}

export function getSystemPrompt(subject: Subject): string {
  switch (subject) {
    case 'chinese':
      return CHINESE_SYSTEM_PROMPT;
    case 'english':
      return ENGLISH_SYSTEM_PROMPT;
    default:
      return MATH_SYSTEM_PROMPT;
  }
}

export async function streamChat(request: ChatRequest): Promise<Response> {
  const { messages, model, apiKey, baseURL, subjectOverride, intentName, questionType } = request;
  const subject = subjectOverride ?? detectSubject(messages);
  let systemPrompt = getSystemPrompt(subject);

  // Append intent and question type context for math to enforce fixed component mapping
  if (subject === 'math' && intentName) {
    systemPrompt += `\n\n【当前意图与题型】\n当前用户点击的意图是：${intentName}`;
    if (questionType?.type_all) {
      systemPrompt += `\n题型（questionType.type_all）：${questionType.type_all}`;
    }
    systemPrompt += '\n请严格按照上述固定组件搭配输出，禁止自由组合。';
  }

  const isAnthropic = !baseURL && apiKey.startsWith('sk-ant-');
  const isGoogle = !baseURL && apiKey.startsWith('AIza');

  // Debug: log what the generation model receives
  console.log('[chat input] subject:', subject);
  console.log('[chat input] system prompt (first 100):', systemPrompt.slice(0, 100));
  for (const m of messages) {
    if (typeof m.content === 'string') {
      console.log(`[chat input] ${m.role}:`, m.content.slice(0, 300));
    } else {
      const parts = m.content.map(p => (p.type === 'image_url' ? '[IMAGE]' : p.text?.slice(0, 200)));
      console.log(`[chat input] ${m.role} (multimodal):`, parts);
    }
  }

  const resolvedModel = isGoogle ? (model || 'gemini-2.0-flash').replace(/^google\//, '') : model || DEFAULT_MODEL;

  // Kimi context window limits: 8k→8192 total, 32k→32768 total.
  const maxTokens = resolvedModel.includes('8k') ? 2000 : resolvedModel.includes('32k') ? 4000 : 4000;

  return callLLM({
    baseURL,
    apiKey,
    model: resolvedModel,
    messages: [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.role, content: m.content }))],
    temperature: 0.7,
    stream: true,
    maxTokens: isAnthropic ? 4096 : maxTokens,
    timeout: FETCH_TIMEOUT_MS,
  });
}
