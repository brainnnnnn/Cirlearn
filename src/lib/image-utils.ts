/**
 * Image processing utilities for upload, validation, cropping, and compression
 */

import type {
  Rectangle,
  SupportedImageFormat,
  ImageValidationResult,
  ImageProcessingOptions,
} from '@/types/image-upload';

// Constants from requirements
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FORMATS: SupportedImageFormat[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];
const MAX_DISPLAY_WIDTH = 800; // Max width for display

/**
 * Validate an image file based on format and size requirements
 * Requirements: 1.2, 9.1, 9.3
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file format
  if (!SUPPORTED_FORMATS.includes(file.type as SupportedImageFormat)) {
    return {
      valid: false,
      error: {
        type: 'file-format',
        message: `Unsupported file format. Supported formats: JPEG, PNG, WebP, HEIC`,
      },
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: {
        type: 'file-size',
        message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      },
    };
  }

  return { valid: true };
}

/**
 * Convert a File object to a base64 data URL
 * Requirements: 1.3, 9.5
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions from a data URL or File
 * Requirements: 1.3
 */
export function getImageDimensions(
  source: string | File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      // Clean up
      if (typeof source !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Crop an image based on rectangle coordinates using Canvas API
 * Requirements: 1.3, 9.4
 */
export async function cropImage(
  imageDataUrl: string,
  coordinates: Rectangle
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas for cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Set canvas size to cropped dimensions
        canvas.width = coordinates.width;
        canvas.height = coordinates.height;
        
        // Draw the cropped portion
        ctx.drawImage(
          img,
          coordinates.x,
          coordinates.y,
          coordinates.width,
          coordinates.height,
          0,
          0,
          coordinates.width,
          coordinates.height
        );
        
        // Convert to data URL
        const croppedDataUrl = canvas.toDataURL('image/png');
        resolve(croppedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for cropping'));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Resize an image to fit within max dimensions while preserving aspect ratio
 * Requirements: 1.3, 9.2, 9.4
 */
export async function resizeImage(
  imageDataUrl: string,
  options: ImageProcessingOptions = {}
): Promise<string> {
  const {
    maxWidth = MAX_DISPLAY_WIDTH,
    maxHeight = Infinity,
    quality = 0.9,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        let { width, height } = img;
        
        // Calculate new dimensions while preserving aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const ratio = Math.min(widthRatio, heightRatio);
          
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to data URL with quality setting
        const resizedDataUrl = canvas.toDataURL(format, quality);
        resolve(resizedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Compress an image by resizing and reducing quality
 * Requirements: 9.2
 */
export async function compressImage(
  imageDataUrl: string,
  targetSizeKB?: number
): Promise<string> {
  // Start with reasonable compression
  let quality = 0.8;
  let maxWidth = MAX_DISPLAY_WIDTH;
  
  let compressed = await resizeImage(imageDataUrl, {
    maxWidth,
    quality,
    format: 'image/jpeg',
  });
  
  // If target size specified, iteratively compress until under target
  if (targetSizeKB) {
    const targetBytes = targetSizeKB * 1024;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      // Estimate size from base64 length (rough approximation)
      const estimatedSize = (compressed.length * 3) / 4;
      
      if (estimatedSize <= targetBytes) {
        break;
      }
      
      // Reduce quality and/or size
      quality = Math.max(0.5, quality - 0.1);
      maxWidth = Math.max(400, Math.round(maxWidth * 0.8));
      
      compressed = await resizeImage(imageDataUrl, {
        maxWidth,
        quality,
        format: 'image/jpeg',
      });
      
      attempts++;
    }
  }
  
  return compressed;
}

/**
 * Validate that a selection rectangle is valid
 * Requirements: 1.3
 */
export function isValidSelection(
  selection: Rectangle,
  imageWidth: number,
  imageHeight: number
): boolean {
  const MIN_SELECTION_SIZE = 10; // Minimum 10x10 pixels (display coords)
  
  // Check minimum size
  if (selection.width < MIN_SELECTION_SIZE || selection.height < MIN_SELECTION_SIZE) {
    return false;
  }
  
  // Check bounds
  if (selection.x < 0 || selection.y < 0) {
    return false;
  }
  
  if (selection.x + selection.width > imageWidth || 
      selection.y + selection.height > imageHeight) {
    return false;
  }
  
  return true;
}

/**
 * Convert a base64 data URL to a Blob
 * Useful for API uploads that require Blob/File objects
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
}

/**
 * Extract base64 data from a data URL
 * Removes the "data:image/png;base64," prefix
 */
export function extractBase64FromDataURL(dataURL: string): string {
  const parts = dataURL.split(',');
  return parts.length > 1 ? parts[1] : dataURL;
}

/**
 * Process an uploaded file: validate, convert to base64, get dimensions
 * Requirements: 1.2, 1.3, 9.1, 9.2, 9.3, 9.4
 */
/**
 * Convert a blob URL (e.g. URL.createObjectURL result) into a base64 data URL
 * so it can be sent to server-side APIs.
 */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load blob image'));
    img.src = blobUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * Process an uploaded file: validate, convert to base64, get dimensions
 * Requirements: 1.2, 1.3, 9.1, 9.2, 9.3, 9.4
 */
export async function processUploadedFile(file: File): Promise<{
  width: number;
  height: number;
}> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error?.message || 'Invalid file');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await getImageDimensions(objectUrl);
    return { width: dimensions.width, height: dimensions.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
