'use client';

import { useState, useCallback, useRef } from 'react';

export interface TextSegment {
  type: 'text';
  content: string;
  key: string;
}

export interface WidgetSegment {
  type: 'widget';
  title: string;
  code: string;
  isStreaming: boolean;
  key: string;
}

export type MessageSegment = TextSegment | WidgetSegment;

export interface IntentResult {
  segments: MessageSegment[];
  isStreaming: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];  // legacy / text-only path
  error?: string;
  intentName?: string;

  // user bubble extras
  imageThumb?: string;  // cropped region data URL

  // assistant bubble state machine
  assistantState?: 'vlm-loading' | 'intent-select' | 'results';
  intents?: import('@/types/image-upload').Intent[];
  results?: Record<number, IntentResult>;
  activeResultIndex?: number;
}

export function useStreamingChat(apiPath = '/api/chat') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    userContent: string,
    config: { apiKey: string; model: string; baseURL?: string; subjectOverride?: 'math' | 'chinese' | 'english'; intentName?: string; questionType?: { type: number; type_16: string; type_all: string } },
  ) => {
    if (!userContent.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userContent,
      segments: [],
    };

    const assistantId = `a-${Date.now()}`;
    const nextMessages = [...messages, userMsg];

    setMessages([...nextMessages, {
      id: assistantId, role: 'assistant', content: '', segments: [], error: undefined,
      intentName: config.intentName,
    }]);
    setIsLoading(true);
    setError(null);

    abortRef.current = new AbortController();

    // Local accumulator — mutate in place, spread to trigger re-render
    const segs: MessageSegment[] = [];
    let widgetCount = 0;

    function applyEvent(event: Record<string, unknown>) {
      switch (event.t) {
        case 'tx': {
          const v = String(event.v ?? '');
          if (!v) break;
          const last = segs[segs.length - 1];
          if (last?.type === 'text') {
            last.content += v;
          } else {
            segs.push({ type: 'text', content: v, key: `t-${segs.length}` });
          }
          break;
        }
        case 'ws': {
          segs.push({ type: 'widget', title: '', code: '', isStreaming: true, key: `w-${widgetCount}` });
          break;
        }
        case 'wd': {
          const w = segs.findLast(s => s.type === 'widget') as WidgetSegment | undefined;
          if (w) w.code = String(event.v ?? '');
          break;
        }
        case 'we': {
          const w = segs.findLast(s => s.type === 'widget') as WidgetSegment | undefined;
          if (w) {
            w.code = String(event.code ?? w.code);
            w.title = String(event.title ?? w.title);
            w.isStreaming = false;
            widgetCount++;
          }
          break;
        }
        case 'err': {
          throw new Error(String(event.v ?? 'Unknown error'));
        }
      }

      // Snapshot: new array + shallow-clone each segment to trigger re-render
      const snapshot = segs.map(s => ({ ...s }));
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, segments: snapshot } : m)
      );
    }

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: nextMessages.map(m => ({
            role: m.role,
            content: m.role === 'assistant'
              ? m.segments.filter(s => s.type === 'text').map(s => (s as TextSegment).content).join('')
              : m.content,
          })),
          model: config.model,
          apiKey: config.apiKey,
          ...(config.baseURL ? { baseURL: config.baseURL } : {}),
          ...(config.subjectOverride ? { subjectOverride: config.subjectOverride } : {}),
          ...(config.intentName ? { intentName: config.intentName } : {}),
          ...(config.questionType ? { questionType: config.questionType } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text() || `API error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            applyEvent(JSON.parse(line) as Record<string, unknown>);
          } catch (e) {
            if (e instanceof Error) throw e;
          }
        }
      }

      // Flush remaining buffer
      if (buf.trim()) {
        try { applyEvent(JSON.parse(buf) as Record<string, unknown>); } catch { /* ignore */ }
      }

      if (segs.length === 0) {
        throw new Error('未收到回复，可能是模型响应超时或服务繁忙，请重试。');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err);
        // Batch all state updates together so isLoading resets atomically
        setError(new Error(msg));
        setIsLoading(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, segments: [], error: msg }
              : m
          )
        );
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, apiPath]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const setMessagesExternal = useCallback((msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages(msgs);
    setIsLoading(false);
    setError(null);
  }, []);

  // Stream a chat response into an existing assistant message's results[intentIndex]
  const streamIntoMessage = useCallback(async (
    messageId: string,
    intentIndex: number,
    userContent: string,
    config: { apiKey: string; model: string; baseURL?: string; subjectOverride?: 'math' | 'chinese' | 'english'; imageDataUrl?: string; fullPageImageUrl?: string; intentName?: string; questionType?: { type: number; type_16: string; type_all: string } },
  ) => {
    // Mark target slot as streaming
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        assistantState: 'results',
        activeResultIndex: intentIndex,
        results: {
          ...(m.results ?? {}),
          [intentIndex]: { segments: [], isStreaming: true },
        },
      };
    }));
    setIsLoading(true);
    setError(null);

    abortRef.current = new AbortController();

    const segs: MessageSegment[] = [];
    let widgetCount = 0;

    function applyEvent(event: Record<string, unknown>) {
      switch (event.t) {
        case 'tx': {
          const v = String(event.v ?? '');
          if (!v) break;
          const last = segs[segs.length - 1];
          if (last?.type === 'text') {
            last.content += v;
          } else {
            segs.push({ type: 'text', content: v, key: `t-${segs.length}` });
          }
          break;
        }
        case 'widget_start':
          segs.push({ type: 'widget', title: String(event.title ?? ''), code: '', isStreaming: true, key: `w-${widgetCount}` });
          break;
        case 'widget_chunk': {
          const w = segs.findLast(s => s.type === 'widget') as WidgetSegment | undefined;
          if (w) w.code += String(event.v ?? '');
          break;
        }
        case 'widget_end': {
          const w = segs.findLast(s => s.type === 'widget') as WidgetSegment | undefined;
          if (w) { w.isStreaming = false; widgetCount++; }
          break;
        }
        case 'error':
          throw new Error(String(event.v ?? 'Unknown error'));
      }
    }

    function flush() {
      const snapshot = segs.map(s => ({ ...s }));
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          results: {
            ...(m.results ?? {}),
            [intentIndex]: { segments: snapshot, isStreaming: true },
          },
        };
      }));
    }

    try {
      // Build user message — multimodal if image provided
      // Full page image first (context), then cropped region (focus)
      const imageParts: Array<{ type: string; image_url: { url: string } }> = [];
      if (config.fullPageImageUrl) {
        imageParts.push({ type: 'image_url', image_url: { url: config.fullPageImageUrl } });
      }
      if (config.imageDataUrl) {
        imageParts.push({ type: 'image_url', image_url: { url: config.imageDataUrl } });
      }
      const userMessageContent = imageParts.length > 0
        ? [...imageParts, { type: 'text', text: userContent }]
        : userContent;

      const historyMessages = [{
        role: 'user' as const,
        content: userMessageContent,
      }];

      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyMessages,
          model: config.model || 'moonshot-v1-8k',
          apiKey: config.apiKey,
          subjectOverride: config.subjectOverride,
          ...(config.baseURL ? { baseURL: config.baseURL } : {}),
          ...(config.intentName ? { intentName: config.intentName } : {}),
          ...(config.questionType ? { questionType: config.questionType } : {}),
        }),
        signal: AbortSignal.any([
          abortRef.current.signal,
          AbortSignal.timeout(185_000),
        ]),
      });

      if (!res.ok) throw new Error(await res.text() || `API error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try { applyEvent(JSON.parse(line)); } catch { /* skip */ }
        }
        flush();
      }

      if (segs.filter(s => s.type === 'text' ? s.content.trim() : s.code.trim()).length === 0) {
        throw new Error('未收到回复，请重试。');
      }

      // Mark done
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          results: {
            ...(m.results ?? {}),
            [intentIndex]: { segments: segs.map(s => ({ ...s })), isStreaming: false },
          },
        };
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          results: {
            ...(m.results ?? {}),
            [intentIndex]: { segments: [], isStreaming: false, error: msg },
          },
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, [apiPath]);

  return { messages, setMessages: setMessagesExternal, isLoading, error, sendMessage, stop, streamIntoMessage };
}
