'use client';

import { useRef, useEffect, useState } from 'react';
import { MessageItem } from './MessageItem';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import type { ChatMessage } from '@/hooks/useStreamingChat';
import { useImageUpload } from '@/hooks/useImageUpload';
import { blobUrlToDataUrl } from '@/lib/image-utils';
import { ImageUploadButton } from './ImageUploadButton';
import { RegionSelector } from './RegionSelector';
import type { VLMProviderConfig, Rectangle } from '@/types/image-upload';

const PROVIDER_MODELS = {
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { value: 'claude-opus-4', label: 'Opus 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  ],
  google: [
    { value: 'gemini-2.5-flash-preview-05-20', label: '2.5 Flash' },
    { value: 'gemini-2.0-flash', label: '2.0 Flash' },
  ],
  kimi: [
    { value: 'moonshot-v1-8k', label: 'v1-8k（推荐）' },
    { value: 'moonshot-v1-32k', label: 'v1-32k' },
    { value: 'kimi-k2.5', label: 'k2.5（慢）' },
  ],
};

const PROVIDER_DEFAULTS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5',
  google: 'gemini-2.5-flash-preview-05-20',
  kimi: 'moonshot-v1-8k',
};

function detectProvider(key: string): 'anthropic' | 'google' | 'kimi' | 'custom' {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza')) return 'google';
  if (key.startsWith('sk-')) return 'kimi';
  return 'custom';
}

const SUBJECT_LABELS: Record<'math' | 'chinese' | 'english', string> = {
  math: '数学',
  chinese: '语文',
  english: '英语',
};

export function ChatInterface() {
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [vlmApiKey, setVlmApiKey] = useState('');
  const [vlmBaseURL, setVlmBaseURL] = useState('');
  const [vlmModel, setVlmModel] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const provider = detectProvider(apiKey);
  const chips = provider !== 'custom' ? PROVIDER_MODELS[provider] : [];
  const defaultModel = PROVIDER_DEFAULTS[provider] ?? '';
  const displayModel = model || defaultModel || '未设置';

  const [vlmProvider, setVlmProvider] = useState<'kimi' | 'gpt4v'>('kimi');
  const { state: imageState, uploadImage, goToPage, setRegion, processWithVLM, selectIntent, reset: resetImage, resetSelection } = useImageUpload();
  const [pageInput, setPageInput] = useState('');

  useEffect(() => {
    if (imageState.pdf) {
      setPageInput(String(imageState.pdf.currentPage));
    }
  }, [imageState.pdf?.currentPage]);

  const { messages, setMessages, isLoading, error, sendMessage, stop, streamIntoMessage } = useStreamingChat('/api/chat');
  // ref to the current intent-bubble message id, used by VLM callback
  const intentBubbleIdRef = useRef<string | null>(null);
  // ref to the cropped image data URL for the current selection
  const croppedImageRef = useRef<string | null>(null);
  // ref to the full page image data URL (for reading comprehension context)
  const fullPageImageRef = useRef<string | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [settingsOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const savedKey = sessionStorage.getItem('genui-api-key');
    if (savedKey) setApiKey(savedKey);
    const savedBase = localStorage.getItem('genui-base-url');
    if (savedBase) setBaseURL(savedBase);
    const savedModel = localStorage.getItem('genui-model');
    if (savedModel) setModel(savedModel);
    const savedVlmKey = sessionStorage.getItem('genui-vlm-api-key');
    if (savedVlmKey) setVlmApiKey(savedVlmKey);
    const savedVlmBase = localStorage.getItem('genui-vlm-base-url');
    if (savedVlmBase) setVlmBaseURL(savedVlmBase);
    const savedVlmModel = localStorage.getItem('genui-vlm-model');
    if (savedVlmModel) setVlmModel(savedVlmModel);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    if (prefersDark) document.documentElement.classList.add('dark');
  }, []);

  // Called when user picks an intent option (or auto-triggered for single intent)
  function handleIntentSelect(messageId: string, intentIndex: number) {
    const bubble = messages.find(m => m.id === messageId);
    if (!bubble) return;

    const intent = bubble.intents?.[intentIndex];
    if (!intent) return;

    // Cached and successful — just switch tab; retry if previously failed
    const existing = bubble.results?.[intentIndex];
    if (existing && !existing.isStreaming && !existing.error) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, assistantState: 'results', activeResultIndex: intentIndex } : m
      ));
      return;
    }

    const parts: string[] = [];
    parts.push(`【意图】${intent.name}`);
    if (intent.content) parts.push(`【题目原文】\n${intent.content}`);
    if (intent.visualDescription) parts.push(`【图形/表格说明】\n${intent.visualDescription}`);
    if (intent.pageContext) parts.push(`【页面背景】\n${intent.pageContext}`);
    parts.push(`【学习目标】${intent.description}`);
    const query = parts.join('\n\n');

    const hasMultipleIntents = (bubble.intents?.length ?? 0) > 1;
    streamIntoMessage(messageId, intentIndex, query, {
      apiKey,
      model,
      baseURL: baseURL.trim() || undefined,
      subjectOverride: intent.subject,
      imageDataUrl: hasMultipleIntents ? undefined : (croppedImageRef.current ?? undefined),
      fullPageImageUrl: hasMultipleIntents ? undefined : (fullPageImageRef.current ?? undefined),
    });
  }

  // When VLM extraction completes, populate intent-select bubble
  useEffect(() => {
    if (imageState.stage !== 'extracted' || !imageState.intents?.length) return;
    const bubbleId = intentBubbleIdRef.current;
    if (!bubbleId) return;

    // Update the assistant bubble to intent-select state
    setMessages(prev => prev.map(m =>
      m.id === bubbleId
        ? { ...m, assistantState: 'intent-select', intents: imageState.intents ?? undefined }
        : m
    ));

    // Auto-fire if single intent
    if (imageState.intents.length === 1) {
      handleIntentSelect(bubbleId, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageState.stage]);

  // When VLM fails, show error in the assistant bubble
  useEffect(() => {
    if (imageState.stage !== 'uploaded' || !imageState.error) return;
    const bubbleId = intentBubbleIdRef.current;
    if (!bubbleId) return;

    setMessages(prev => prev.map(m =>
      m.id === bubbleId
        ? { ...m, assistantState: 'results', error: imageState.error ?? undefined }
        : m
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageState.error, imageState.stage]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  function saveApiKey(val: string) {
    setApiKey(val);
    sessionStorage.setItem('genui-api-key', val);
  }

  function saveBaseURL(val: string) {
    setBaseURL(val);
    localStorage.setItem('genui-base-url', val);
  }

  function saveModel(val: string) {
    setModel(val);
    localStorage.setItem('genui-model', val);
  }

  function saveVlmApiKey(val: string) {
    setVlmApiKey(val);
    sessionStorage.setItem('genui-vlm-api-key', val);
  }

  function saveVlmBaseURL(val: string) {
    setVlmBaseURL(val);
    localStorage.setItem('genui-vlm-base-url', val);
  }

  function saveVlmModel(val: string) {
    setVlmModel(val);
    localStorage.setItem('genui-vlm-model', val);
  }

  // Called when user picks a file
  async function handleImageSelect(file: File) {
    resetImage();
    setMessages([]);
    await uploadImage(file);
  }

  // Called when user confirms region selection
  async function handleRegionSelect(croppedDataUrl: string, coordinates: Rectangle) {
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now() + 1}`;
    intentBubbleIdRef.current = assistantId;
    croppedImageRef.current = croppedDataUrl;

    const origSrc = imageState.originalImage?.dataUrl ?? null;
    if (origSrc && origSrc.startsWith('blob:')) {
      try {
        fullPageImageRef.current = await blobUrlToDataUrl(origSrc);
      } catch {
        fullPageImageRef.current = null;
      }
    } else {
      fullPageImageRef.current = origSrc;
    }

    // Add user bubble (thumbnail) + assistant bubble (vlm-loading)
    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user', content: '', segments: [], imageThumb: croppedDataUrl },
      { id: assistantId, role: 'assistant', content: '', segments: [], assistantState: 'vlm-loading' },
    ]);

    const effectiveKey = vlmApiKey.trim() || apiKey;
    const effectiveBase = vlmBaseURL.trim() || baseURL.trim() || undefined;
    const effectiveModel = vlmModel.trim() || undefined;
    const config: VLMProviderConfig = {
      provider: vlmProvider,
      apiKey: effectiveKey,
      ...(effectiveBase ? { baseURL: effectiveBase } : {}),
      ...(effectiveModel ? { model: effectiveModel } : {}),
    };
    await setRegion(croppedDataUrl, coordinates);
    await processWithVLM(config);
  }

  function submit() {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    const text = input;
    setInput('');
    sendMessage(text, { apiKey, model, baseURL: baseURL.trim() || undefined });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = !isLoading && !!apiKey && !!input.trim();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* LEFT PANEL: Image Upload & Preview */}
      <div className="w-1/2 border-r border-border/50 flex flex-col">
        {/* Left Panel Header */}
        <div className="px-4 h-[45px] flex items-center justify-between border-b border-border/50 shrink-0">
          <h2 className="text-sm font-semibold">图片识别</h2>
          {imageState.originalImage && (
            <ImageUploadButton onImageSelect={handleImageSelect} disabled={isLoading} compact />
          )}
        </div>

        {/* Image Display Area */}
        <div className="flex-1 overflow-auto relative">
          {!imageState.originalImage ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-6">
              {imageState.isProcessing ? (
                <>
                  <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <p className="text-sm text-muted-foreground">PDF 加载中…</p>
                </>
              ) : (
                <>
                  <div className="text-4xl text-muted-foreground/40">📄</div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">上传图片或 PDF</p>
                    <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP、HEIC、PDF</p>
                  </div>
                  <ImageUploadButton onImageSelect={handleImageSelect} disabled={isLoading} />
                </>
              )}
            </div>
          ) : (
            /* Image / PDF page preview */
            <div className="relative w-full">
              {imageState.isProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageState.originalImage.dataUrl}
                alt="上传的题目图片"
                className="block w-full h-auto object-contain"
                draggable={false}
              />
              {!imageState.isProcessing && imageState.stage !== 'processing' && (
                <RegionSelector
                  imageRef={imageRef}
                  onSelectionComplete={handleRegionSelect}
                  disabled={isLoading}
                />
              )}
            </div>
          )}
        </div>

        {/* PDF page navigation */}
        {imageState.pdf && imageState.pdf.totalPages > 1 && (
          <div className="shrink-0 border-t border-border/50 px-4 py-3 min-h-[66px] flex items-center justify-between">
            <button
              type="button"
              disabled={imageState.pdf.currentPage <= 1 || imageState.isProcessing}
              onClick={() => goToPage(imageState.pdf!.currentPage - 1)}
              className="w-7 h-7 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {imageState.isProcessing ? (
                <span>加载中…</span>
              ) : (
                <>
                  <input
                    type="number"
                    min={1}
                    max={imageState.pdf.totalPages}
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const page = parseInt(pageInput, 10);
                        if (!Number.isNaN(page)) {
                          const clamped = Math.max(1, Math.min(imageState.pdf!.totalPages, page));
                          goToPage(clamped);
                        }
                      }
                    }}
                    onBlur={() => {
                      const page = parseInt(pageInput, 10);
                      if (!Number.isNaN(page)) {
                        const clamped = Math.max(1, Math.min(imageState.pdf!.totalPages, page));
                        if (clamped !== imageState.pdf!.currentPage) {
                          goToPage(clamped);
                        } else {
                          setPageInput(String(imageState.pdf!.currentPage));
                        }
                      } else {
                        setPageInput(String(imageState.pdf!.currentPage));
                      }
                    }}
                    className="w-10 h-6 rounded border border-border/50 bg-background text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span>/ {imageState.pdf.totalPages}</span>
                </>
              )}
            </div>
            <button
              type="button"
              disabled={imageState.pdf.currentPage >= imageState.pdf.totalPages || imageState.isProcessing}
              onClick={() => goToPage(imageState.pdf!.currentPage + 1)}
              className="w-7 h-7 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}

        {/* VLM error panel — only shown when imageState has an error */}
        {imageState.stage === 'uploaded' && imageState.error && (
          <div className="border-t border-border/50 p-4 shrink-0">
            <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-3 flex items-start gap-2">
              <span className="text-destructive mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive mb-1">识别失败</p>
                <p className="text-xs text-destructive/80">{imageState.error}</p>
                <button type="button" onClick={resetSelection} className="mt-3 text-xs px-3 py-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors">
                  重新圈选
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Chat Interface */}
      <div className="w-1/2 flex flex-col">
        {/* Right Panel Header */}
        <header className="h-[45px] flex items-center justify-between px-4 border-b border-border/50 shrink-0">
          {/* Left: brand */}
          <span className="font-semibold text-sm">AI Tutor</span>

          {/* Right: settings + theme */}
          <div className="flex items-center gap-2">
            <div ref={settingsRef} className="relative z-50">
              <button
                onClick={() => setSettingsOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border/50 hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                {!apiKey && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                <span className="max-w-[160px] truncate">
                  {apiKey ? displayModel : '设置 API Key'}
                </span>
                <span className="opacity-50 text-[10px]">⚙</span>
              </button>

            {/* Settings popover */}
            {settingsOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border/50 rounded-xl shadow-lg z-[100] p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">API 设置</span>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-ant-… (Anthropic) / AIza… (Google)"
                    value={apiKey}
                    onChange={e => saveApiKey(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                </div>

                {/* Base URL */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Base URL
                    <span className="opacity-50 ml-1">（其他提供商必填）</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/v1"
                    value={baseURL}
                    onChange={e => saveBaseURL(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                </div>

                {/* Model */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted-foreground">
                    模型
                    {defaultModel && !model && (
                      <span className="opacity-50 ml-1">（留空使用 {defaultModel}）</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder={defaultModel || 'model-id'}
                    value={model}
                    onChange={e => saveModel(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                  {/* Provider chips */}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {chips.map(c => (
                        <button
                          key={c.value}
                          onClick={() => saveModel(c.value)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                            model === c.value
                              ? 'border-foreground/30 bg-muted text-foreground'
                              : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border/30 pt-2">
                  <span className="text-[11px] text-muted-foreground/60 font-medium">图片识别（意图识别）</span>
                </div>

                {/* VLM provider */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">识别服务</label>
                  <select
                    value={vlmProvider}
                    onChange={e => setVlmProvider(e.target.value as 'kimi' | 'gpt4v')}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  >
                    <option value="kimi">Kimi Vision</option>
                    <option value="gpt4v">GPT-4V / GPT-4o</option>
                  </select>
                </div>

                {/* VLM API Key */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    API Key
                    <span className="opacity-50 ml-1">（留空则使用上方 Key）</span>
                  </label>
                  <input
                    type="password"
                    placeholder="留空时复用生成模型的 Key"
                    value={vlmApiKey}
                    onChange={e => saveVlmApiKey(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                </div>

                {/* VLM Base URL */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    Base URL
                    <span className="opacity-50 ml-1">（留空则使用上方 URL）</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/v1"
                    value={vlmBaseURL}
                    onChange={e => saveVlmBaseURL(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                </div>

                {/* VLM Model */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">
                    视觉模型
                    <span className="opacity-50 ml-1">（留空使用默认）</span>
                  </label>
                  <input
                    type="text"
                    placeholder={vlmProvider === 'kimi' ? 'moonshot-v1-8k-vision-preview' : 'gpt-4o'}
                    value={vlmModel}
                    onChange={e => saveVlmModel(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background focus:outline-none focus:border-border"
                  />
                </div>
              </div>
            )}
            </div>

            <button
              onClick={toggleTheme}
              className="text-xs px-2.5 py-1 rounded-md border border-border/50 hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              {isDark ? '☀' : '☾'}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <p className="text-sm font-medium">问任何学科的问题，复杂概念会配上交互图解</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {[
                  '用动画解释梯度下降',
                  '傅里叶变换是什么，可视化一下',
                  '帮我理解贝叶斯定理',
                  '牛顿第二定律，让我调参数感受一下',
                ].map(ex => (
                  <button
                    key={ex}
                    className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setInput(ex);
                      inputRef.current?.focus();
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadMockDemo(setMessages)}
                className="text-xs px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
              >
                🎬 查看卡片演示（无需API）
              </button>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
            return (
              <MessageItem
                key={msg.id}
                messageId={msg.id}
                role={msg.role}
                content={msg.content}
                segments={msg.segments}
                isStreaming={isLastAssistant && isLoading}
                error={msg.error}
                intentName={msg.intentName}
                imageThumb={msg.imageThumb}
                assistantState={msg.assistantState}
                intents={msg.intents}
                results={msg.results}
                activeResultIndex={msg.activeResultIndex}
                onIntentSelect={(intentIndex) => handleIntentSelect(msg.id, intentIndex)}
                onRetry={handleIntentSelect}
              />
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 min-h-[66px] border-t border-border/50">
          <form
            onSubmit={e => { e.preventDefault(); if (canSend) submit(); }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={apiKey ? '问任何问题…（Enter 发送，Shift+Enter 换行）' : '先填入 API Key 才能开始'}
              disabled={!apiKey || isLoading}
              rows={1}
              className="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl border border-border/50 bg-background focus:outline-none focus:border-border/80 disabled:opacity-50 min-h-[42px] max-h-48 overflow-y-auto"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              type={isLoading ? 'button' : 'submit'}
              onClick={isLoading ? stop : undefined}
              disabled={!isLoading && !canSend}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              {isLoading ? 'Stop' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Mock demo data ───────────────────────────────────────────────────────────

function loadMockDemo(setMessages: (msgs: ChatMessage[]) => void) {
  const mockAssistantText = `## 题目信息
已知：函数 f(x) = x² - 4x + 3，定义域为 [0, 5]
所求：f(x) 在该区间上的最大值和最小值

## 解题思路
这是一个开口向上的抛物线，先配方找顶点，再比较区间端点。

## 分步推导
1. 配方：f(x) = (x - 2)² - 1
2. 顶点坐标 (2, -1)，对称轴 x = 2
3. 对称轴在区间 [0, 5] 内，最小值在顶点
4. 比较端点：f(0) = 3，f(5) = 8
5. 最大值在 x = 5：f(5) = 8

## 答案
最小值 **-1**（当 x = 2 时），最大值 **8**（当 x = 5 时）`;

  const demoMessages: ChatMessage[] = [
    {
      id: 'u-demo',
      role: 'user',
      content: '求函数 f(x) = x² - 4x + 3 在区间 [0, 5] 上的最值',
      segments: [],
    },
    {
      id: 'a-demo',
      role: 'assistant',
      content: mockAssistantText,
      segments: [{ type: 'text', content: mockAssistantText, key: 't-demo' }],
    },
  ];

  setMessages(demoMessages);
}
