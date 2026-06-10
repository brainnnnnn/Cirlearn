/**
 * TypeScript interfaces for image upload and VLM processing
 */

/**
 * Rectangle coordinates for image region selection
 */
export interface Rectangle {
  x: number;      // pixels from left
  y: number;      // pixels from top
  width: number;  // pixels
  height: number; // pixels
}

/**
 * Client-side state for image upload workflow
 */
export interface ImageUploadState {
  // Current workflow stage
  stage: 'idle' | 'uploaded' | 'selecting' | 'processing' | 'extracted' | 'confirmed';
  
  // Image data
  originalImage: {
    file: File;
    dataUrl: string;  // current page data URL (blob URL for images, canvas dataURL for PDF)
    width: number;
    height: number;
  } | null;

  // PDF-specific state
  pdf: {
    arrayBuffer: ArrayBuffer;
    totalPages: number;
    currentPage: number;
  } | null;
  
  croppedImage: {
    dataUrl: string;
    coordinates: Rectangle;
  } | null;
  
  // Extraction results — one or more intents returned by VLM
  intents: Intent[] | null;
  selectedIntentIndex: number; // which tab is active
  
  // UI state
  isProcessing: boolean;
  error: string | null;
}

/**
 * Configuration for VLM API providers
 */
export interface VLMProviderConfig {
  provider: 'kimi' | 'gpt4v';
  apiKey: string;
  baseURL?: string;
  model?: string; // optional model override
}

/**
 * A single recognized intent from VLM analysis
 */
export interface Intent {
  name: string;
  description: string;
  confidence: number;
  content: string;            // OCR extracted core content (raw text)
  visualDescription: string;  // VLM's description of figures, tables, diagrams
  pageContext: string;        // grade, chapter, page type inferred from full image
  subject: 'math' | 'chinese' | 'english';
}

/**
 * VLM API response structure
 */
export interface VLMResponse {
  success: boolean;
  data?: {
    intents: Intent[];
  };
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Supported image file formats
 */
export type SupportedImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/**
 * Image validation result
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: {
    type: 'file-size' | 'file-format' | 'file-read';
    message: string;
  };
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 for JPEG compression
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}
