'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { resolveThemeVars, getWidgetIframeStyleBlock } from '@/lib/widget-css-bridge';
import { sanitizeForStreaming, sanitizeForIframe, buildReceiverSrcdoc } from '@/lib/widget-sanitizer';

interface WidgetRendererProps {
  widgetCode: string;
  isStreaming: boolean;
  title?: string;
  showOverlay?: boolean;
}

const MAX_IFRAME_HEIGHT = 2000;
const STREAM_DEBOUNCE = 120;
const CDN_PATTERN = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh/;

function detectWidgetType(code: string): string {
  const c = code.toLowerCase();
  if (c.includes('jsxgraph') || c.includes('jxg.jsxgraph') || c.includes('initboard(')) return 'jsxgraph';
  if (c.includes('hanziwriter') || c.includes('hanzi-writer')) return 'hanzi-writer';
  if (c.includes('chart.js') || c.includes('new chart(') || c.includes('chartjs')) return 'chart.js';
  if (c.includes('<svg')) return 'svg';
  if (c.includes('<canvas')) return 'canvas';
  return 'html/dom';
}

function summarizeWidget(code: string): string {
  const type = detectWidgetType(code);
  const cdns = Array.from(code.match(/https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|esm\.sh)[^"'\s]+/g) ?? []);
  return `[widget debug] type=${type} cdns=[${cdns.join(', ')}] length=${code.length}\n${code.slice(0, 2000)}`;
}

/** Module-level height cache — persists across streaming→finalized remount */
const _heightCache = new Map<string, number>();
function getHeightCacheKey(code: string): string {
  return code.slice(0, 200);
}

export function WidgetRenderer({ widgetCode, isStreaming, title, showOverlay }: WidgetRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(() => {
    return _heightCache.get(getHeightCacheKey(widgetCode)) || 0;
  });
  const [showCode, setShowCode] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const hasReceivedFirstHeight = useRef(
    (_heightCache.get(getHeightCacheKey(widgetCode)) || 0) > 0
  );
  const heightLockedRef = useRef(false);
  const hasCDN = useMemo(() => CDN_PATTERN.test(widgetCode), [widgetCode]);

  // Debug: log widget rendering type/CDNs when code stabilizes
  useEffect(() => {
    if (!isStreaming && widgetCode) {
      console.log(summarizeWidget(widgetCode));
    }
  }, [widgetCode, isStreaming]);

  const srcdoc = useMemo(() => {
    const isDark = typeof document !== 'undefined'
      && document.documentElement.classList.contains('dark');
    const resolvedVars = resolveThemeVars();
    const styleBlock = getWidgetIframeStyleBlock(resolvedVars);
    return buildReceiverSrcdoc(styleBlock, isDark);
  }, []);

  // ── postMessage handler ────────────────────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== 'string') return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

      switch (e.data.type) {
        case 'widget:ready':
          setIframeReady(true);
          break;

        case 'widget:resize':
          if (typeof e.data.height === 'number' && e.data.height > 0) {
            const newH = Math.min(e.data.height, MAX_IFRAME_HEIGHT);
            const cacheKey = getHeightCacheKey(widgetCode);
            if (heightLockedRef.current) {
              setIframeHeight(prev => {
                const h = Math.max(prev, newH);
                _heightCache.set(cacheKey, h);
                return h;
              });
              break;
            }
            _heightCache.set(cacheKey, newH);
            if (!hasReceivedFirstHeight.current) {
              hasReceivedFirstHeight.current = true;
              const el = iframeRef.current;
              if (el) {
                el.style.transition = 'none';
                void el.offsetHeight;
              }
              setIframeHeight(newH);
              requestAnimationFrame(() => {
                if (el) el.style.transition = 'height 0.3s ease-out';
              });
            } else {
              setIframeHeight(newH);
            }
          }
          break;

        case 'widget:link': {
          const href = String(e.data.href || '');
          if (href && !/^\s*(javascript|data)\s*:/i.test(href)) {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          break;
        }

        case 'widget:sendMessage': {
          const text = String(e.data.text || '');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = (window as any).__widgetSendMessage;
          if (text && text.length <= 500 && typeof fn === 'function') {
            fn(text);
          }
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widgetCode]);

  // ── Streaming updates ──────────────────────────────────────────────────
  const sendUpdate = useCallback((html: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (html === lastSentRef.current) return;
    lastSentRef.current = html;
    iframe.contentWindow.postMessage({ type: 'widget:update', html }, '*');
  }, []);

  useEffect(() => {
    if (!isStreaming || !iframeReady) return;
    const sanitized = sanitizeForStreaming(widgetCode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => sendUpdate(sanitized), STREAM_DEBOUNCE);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [widgetCode, isStreaming, iframeReady, sendUpdate]);

  // ── Finalize ───────────────────────────────────────────────────────────
  const finalizedCodeRef = useRef('');
  useEffect(() => {
    if (isStreaming || !iframeReady) return;
    if (finalizedCodeRef.current === widgetCode) return;
    const sanitized = sanitizeForIframe(widgetCode);
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    finalizedCodeRef.current = widgetCode;
    lastSentRef.current = sanitized;
    heightLockedRef.current = true;
    iframe.contentWindow.postMessage({ type: 'widget:finalize', html: sanitized }, '*');
    setTimeout(() => {
      heightLockedRef.current = false;
      setFinalized(true);
    }, 400);
  }, [isStreaming, iframeReady, widgetCode]);

  // ── Theme sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!iframeReady) return;
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains('dark');
      const vars = resolveThemeVars();
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'widget:theme', vars, isDark: nowDark }, '*',
      );
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [iframeReady]);

  const showLoadingOverlay = hasCDN && !isStreaming && iframeReady && !finalized;

  // Ensure the widget is always interactive/inspectable even if the inner iframe
  // reports zero height (e.g. JSXGraph board created off-DOM or sizing bug).
  const containerMinHeight = Math.max(80, iframeHeight);

  return (
    <div className="group/widget relative my-2 rounded-lg overflow-hidden border border-border/30" style={{ minHeight: containerMinHeight }}>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        title={title || 'Widget'}
        onLoad={() => setIframeReady(true)}
        style={{
          width: '100%',
          height: Math.max(80, iframeHeight),
          border: 'none',
          display: showCode ? 'none' : 'block',
          overflow: 'hidden',
          colorScheme: 'auto',
        }}
      />

      {(showLoadingOverlay || showOverlay) && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(128,128,128,0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'widget-shimmer 1.5s ease-in-out infinite',
          }}
        />
      )}

      {showCode && (
        <pre className="p-3 text-xs rounded-lg bg-muted/30 overflow-x-auto max-h-80 overflow-y-auto">
          <code>{widgetCode}</code>
        </pre>
      )}

      <div className="absolute top-1 right-1 z-10">
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground hover:text-muted-foreground hover:bg-muted/50 border border-border/40 shadow-sm"
        >
          {showCode ? 'hide code' : 'show code'}
        </button>
      </div>
    </div>
  );
}
