'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { processUploadedFile } from '@/lib/image-utils';
import { loadPDF, renderPDFPage } from '@/lib/pdf-utils';
import type { ImageUploadState, VLMProviderConfig, Rectangle } from '@/types/image-upload';

const INITIAL_STATE: ImageUploadState = {
  stage: 'idle',
  originalImage: null,
  croppedImage: null,
  intents: null,
  selectedIntentIndex: 0,
  pdf: null,
  isProcessing: false,
  error: null,
};

export function useImageUpload() {
  const [state, setState] = useState<ImageUploadState>(INITIAL_STATE);
  const stateRef = useRef<ImageUploadState>(INITIAL_STATE);

  const lastVLMConfigRef = useRef<VLMProviderConfig | null>(null);
  const croppedDataUrlRef = useRef<string | null>(null);

  // Keep stateRef in sync so callVLM can read latest state without stale closure
  useEffect(() => { stateRef.current = state; }, [state]);

  // ─── Internal helper ──────────────────────────────────────────────────────

  const callVLM = useCallback(async (imageDataUrl: string, config: VLMProviderConfig) => {
    try {
      // Get full page image — for PDF pages this is a canvas dataUrl, for images a blob URL
      // We need a dataUrl (not blob URL) to send to API; if it's a blob URL convert via canvas
      let fullPageDataUrl: string | undefined;
      const origSrc = stateRef.current?.originalImage?.dataUrl;
      if (origSrc && origSrc !== imageDataUrl) {
        if (origSrc.startsWith('blob:')) {
          // Convert blob URL to dataUrl via canvas
          try {
            const img = new Image();
            await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = origSrc; });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            fullPageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          } catch { /* skip full page if conversion fails */ }
        } else {
          fullPageDataUrl = origSrc;
        }
      }

      const response = await fetch('/api/vlm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          ...(fullPageDataUrl ? { fullPageImage: fullPageDataUrl } : {}),
          provider: config.provider,
          apiKey: config.apiKey,
          ...(config.baseURL ? { baseURL: config.baseURL } : {}),
          ...(config.model ? { model: config.model } : {}),
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || `VLM API error ${response.status}`);
      }

      setState(prev => ({
        ...prev,
        stage: 'extracted',
        intents: json.data.intents,
        selectedIntentIndex: 0,
        isProcessing: false,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, stage: 'uploaded', isProcessing: false, error: message }));
    }
  }, []);

  // ─── Public API ───────────────────────────────────────────────────────────

  const uploadImage = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // ── PDF path ──────────────────────────────────────────────────────────
      if (file.type === 'application/pdf') {
        const { totalPages, arrayBuffer } = await loadPDF(file);
        const page = await renderPDFPage(arrayBuffer, 1);

        setState({
          stage: 'uploaded',
          originalImage: { file, dataUrl: page.dataUrl, width: page.width, height: page.height },
          croppedImage: null,
          intents: null,
          selectedIntentIndex: 0,
          pdf: { arrayBuffer, totalPages, currentPage: 1 },
          isProcessing: false,
          error: null,
        });
        return;
      }

      // ── Image path ────────────────────────────────────────────────────────
      if (file.size > 10 * 1024 * 1024) throw new Error('图片大小不能超过 10MB');
      if (!file.type.startsWith('image/')) throw new Error('请选择图片或 PDF 文件');

      const dataUrl = URL.createObjectURL(file);
      setState({
        stage: 'uploaded',
        originalImage: { file, dataUrl, width: 0, height: 0 },
        croppedImage: null,
        intents: null,
        selectedIntentIndex: 0,
        pdf: null,
        isProcessing: false,
        error: null,
      });
    } catch (err) {
      console.error('[uploadImage error]', err);
      const message = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, isProcessing: false, error: message }));
    }
  }, []);

  const goToPage = useCallback(async (pageNumber: number) => {
    setState(prev => {
      if (!prev.pdf) return prev;
      return { ...prev, isProcessing: true, error: null };
    });

    setState(prev => {
      if (!prev.pdf) return prev;
      const { arrayBuffer, totalPages } = prev.pdf;
      const target = Math.max(1, Math.min(pageNumber, totalPages));

      // async render — we kick it off and update state when done
      renderPDFPage(arrayBuffer, target).then(page => {
        setState(s => {
          if (!s.pdf) return s;
          return {
            ...s,
            originalImage: { file: s.originalImage!.file, dataUrl: page.dataUrl, width: page.width, height: page.height },
            croppedImage: null,
            pdf: { ...s.pdf, currentPage: target },
            isProcessing: false,
          };
        });
      }).catch(err => {
        setState(s => ({ ...s, isProcessing: false, error: err.message }));
      });

      return { ...prev, pdf: { ...prev.pdf, currentPage: target } };
    });
  }, []);

  const setRegion = useCallback(async (croppedDataUrl: string, coordinates: Rectangle) => {
    croppedDataUrlRef.current = croppedDataUrl;
    setState(prev => ({
      ...prev,
      stage: 'processing',
      croppedImage: { dataUrl: croppedDataUrl, coordinates },
      isProcessing: true,
      error: null,
    }));

    const config = lastVLMConfigRef.current;
    if (config) {
      await callVLM(croppedDataUrl, config);
    } else {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [callVLM]);

  const processWithVLM = useCallback(async (config: VLMProviderConfig) => {
    lastVLMConfigRef.current = config;
    const imageDataUrl = croppedDataUrlRef.current;
    if (!imageDataUrl) {
      setState(prev => ({ ...prev, error: 'No cropped image available' }));
      return;
    }
    setState(prev => ({ ...prev, stage: 'processing', isProcessing: true, error: null }));
    await callVLM(imageDataUrl, config);
  }, [callVLM]);

  const selectIntent = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedIntentIndex: index }));
  }, []);

  const reset = useCallback(() => {
    lastVLMConfigRef.current = null;
    croppedDataUrlRef.current = null;
    setState(prev => {
      if (prev.originalImage?.dataUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.originalImage.dataUrl);
      }
      return INITIAL_STATE;
    });
  }, []);

  const resetSelection = useCallback(() => {
    croppedDataUrlRef.current = null;
    lastVLMConfigRef.current = null;
    setState(prev => ({
      ...prev,
      stage: 'uploaded',
      croppedImage: null,
      intents: null,
      selectedIntentIndex: 0,
      isProcessing: false,
      error: null,
    }));
  }, []);

  return { state, uploadImage, goToPage, setRegion, processWithVLM, selectIntent, reset, resetSelection };
}
