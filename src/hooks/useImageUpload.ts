'use client';

import { useState, useCallback, useRef } from 'react';
import { processUploadedFile } from '@/lib/image-utils';
import type { ImageUploadState, VLMProviderConfig, Rectangle } from '@/types/image-upload';

const INITIAL_STATE: ImageUploadState = {
  stage: 'idle',
  originalImage: null,
  croppedImage: null,
  intents: null,
  selectedIntentIndex: 0,
  isProcessing: false,
  error: null,
};

export function useImageUpload() {
  const [state, setState] = useState<ImageUploadState>(INITIAL_STATE);

  // Refs so callbacks can always access the latest values without stale closures
  const lastVLMConfigRef = useRef<VLMProviderConfig | null>(null);
  const croppedDataUrlRef = useRef<string | null>(null);

  // ─── Internal helper ──────────────────────────────────────────────────────

  const callVLM = useCallback(
    async (imageDataUrl: string, config: VLMProviderConfig) => {
      try {
        const response = await fetch('/api/vlm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
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

        const { intents } = json.data;

        setState(prev => ({
          ...prev,
          stage: 'extracted',
          intents,
          selectedIntentIndex: 0,
          isProcessing: false,
          error: null,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // On error go back to 'uploaded' so user can retry or close
        setState(prev => ({
          ...prev,
          stage: 'uploaded',
          isProcessing: false,
          error: message,
        }));
      }
    },
    [],
  );

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Validate and load a File into the upload state.
   * Sets stage → 'uploaded'.
   */
  const uploadImage = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('图片大小不能超过 10MB');
      if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');

      const dataUrl = URL.createObjectURL(file);

      setState({
        stage: 'uploaded',
        originalImage: { file, dataUrl, width: 0, height: 0 },
        croppedImage: null,
        intents: null,
        selectedIntentIndex: 0,
        isProcessing: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, isProcessing: false, error: message }));
    }
  }, []);

  /**
   * Store the cropped region, then immediately call the VLM if a config is
   * already available (i.e. a previous processWithVLM call stored one).
   * Sets stage → 'processing' while waiting.
   *
   * Exposed so that manual retry can also call processWithVLM directly.
   */
  const setRegion = useCallback(
    async (croppedDataUrl: string, coordinates: Rectangle) => {
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
        // No config yet — stay at 'processing' stage; caller must invoke
        // processWithVLM with a config to kick off the VLM call.
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    },
    [callVLM],
  );

  /**
   * Call the VLM API with the current cropped image.
   * Also exposed for manual retry after an error.
   * Sets stage → 'processing', then 'extracted' on success.
   */
  const processWithVLM = useCallback(
    async (config: VLMProviderConfig) => {
      lastVLMConfigRef.current = config;

      const imageDataUrl = croppedDataUrlRef.current;
      if (!imageDataUrl) {
        setState(prev => ({
          ...prev,
          error: 'No cropped image available for processing',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        stage: 'processing',
        isProcessing: true,
        error: null,
      }));

      await callVLM(imageDataUrl, config);
    },
    [callVLM],
  );

  /**
   * Accept the extracted text (possibly edited by the user).
   * Sets stage → 'confirmed'.
   */
  const selectIntent = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedIntentIndex: index }));
  }, []);

  /**
   * Reset everything back to the idle state.
   */
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

  return { state, uploadImage, setRegion, processWithVLM, selectIntent, reset, resetSelection };
}
