export type Subject = 'math' | 'chinese' | 'english';
export type Provider = 'kimi' | 'gpt4v';

export interface QuestionType {
  type: number;
  type_16: string;
  type_all: string;
}

export interface IntentData {
  name: string;
  description: string;
  confidence: number;
  content: string;
  visualDescription: string;
  pageContext: string;
  subject: Subject;
  questionType?: QuestionType;
  knowledgePoint?: string;
}

export interface VLMData {
  intents: IntentData[];
}

export interface VLMRequest {
  image: string;
  fullPageImage?: string;
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface VLMResponse {
  success: boolean;
  data?: VLMData;
  error?: {
    message: string;
    code: string;
  };
}

export interface ChatMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: unknown }>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  baseURL?: string;
  subjectOverride?: Subject;
  intentName?: string;
  questionType?: QuestionType;
}

export interface StreamChunk {
  t: string;
  v: string;
}
