# Image Upload Utilities

This module provides utilities for image validation, processing, and manipulation for the image upload feature.

## Files Created

### 1. `src/types/image-upload.ts`
TypeScript type definitions for image upload functionality.

**Key Interfaces:**
- `Rectangle` - Coordinates for image region selection
- `ImageUploadState` - Client-side state management for upload workflow
- `VLMProviderConfig` - Configuration for Vision Language Model APIs
- `VLMResponse` - Response structure from VLM APIs
- `ImageValidationResult` - Result of image file validation
- `ImageProcessingOptions` - Options for image processing operations

### 2. `src/lib/image-utils.ts`
Core utility functions for image processing.

**Key Functions:**

#### Validation
- `validateImageFile(file: File): ImageValidationResult`
  - Validates file format (JPEG, PNG, WebP, HEIC)
  - Validates file size (max 10MB)
  - Returns structured validation result

#### Conversion
- `fileToBase64(file: File): Promise<string>`
  - Converts File object to base64 data URL
  - Handles FileReader errors

- `getImageDimensions(source: string | File): Promise<{ width, height }>`
  - Extracts image dimensions from data URL or File

#### Processing
- `cropImage(imageDataUrl: string, coordinates: Rectangle): Promise<string>`
  - Crops image using HTML5 Canvas API
  - Returns cropped region as base64 data URL

- `resizeImage(imageDataUrl: string, options?: ImageProcessingOptions): Promise<string>`
  - Resizes image while preserving aspect ratio
  - Default max width: 800px
  - Configurable quality and format

- `compressImage(imageDataUrl: string, targetSizeKB?: number): Promise<string>`
  - Compresses image by reducing quality and/or size
  - Iteratively compresses to meet target size if specified

#### Utility Functions
- `isValidSelection(selection: Rectangle, imageWidth: number, imageHeight: number): boolean`
  - Validates selection rectangle (min 20x20px, within bounds)

- `dataURLToBlob(dataURL: string): Blob`
  - Converts data URL to Blob for API uploads

- `extractBase64FromDataURL(dataURL: string): string`
  - Extracts base64 string from data URL

- `processUploadedFile(file: File): Promise<{ dataUrl, width, height, validation }>`
  - Complete file processing pipeline
  - Validates, converts, and resizes in one call

## Usage Examples

### Basic File Validation

```typescript
import { validateImageFile } from '@/lib/image-utils';

function handleFileSelect(file: File) {
  const validation = validateImageFile(file);
  
  if (!validation.valid) {
    console.error(validation.error?.message);
    return;
  }
  
  // File is valid, proceed with upload
}
```

### Complete Upload Processing

```typescript
import { processUploadedFile } from '@/lib/image-utils';

async function handleImageUpload(file: File) {
  try {
    const { dataUrl, width, height } = await processUploadedFile(file);
    
    // Display image
    setImageSrc(dataUrl);
    setImageDimensions({ width, height });
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### Image Cropping

```typescript
import { cropImage } from '@/lib/image-utils';

async function handleRegionSelect(coords: Rectangle) {
  const croppedDataUrl = await cropImage(originalImageDataUrl, coords);
  
  // Send cropped image to VLM API
  await processWithVLM(croppedDataUrl);
}
```

### Image Compression

```typescript
import { compressImage } from '@/lib/image-utils';

async function prepareForUpload(imageDataUrl: string) {
  // Compress to under 1MB for API upload
  const compressed = await compressImage(imageDataUrl, 1024);
  
  return compressed;
}
```

## Constants

- **MAX_FILE_SIZE**: 10MB (10,485,760 bytes)
- **SUPPORTED_FORMATS**: JPEG, PNG, WebP, HEIC
- **MAX_DISPLAY_WIDTH**: 800px
- **MIN_SELECTION_SIZE**: 20x20 pixels

## Requirements Mapping

- **Requirement 1.2**: Image file validation (format and size)
- **Requirement 1.3**: Base64 encoding and image display
- **Requirement 9.1**: File size limits (10MB max)
- **Requirement 9.2**: Image compression for large files
- **Requirement 9.3**: Support for multiple image formats
- **Requirement 9.4**: Image resizing and cropping with Canvas API

## Browser Compatibility

All functions use standard Web APIs:
- FileReader API
- Canvas API
- Image object
- Blob API

Supported in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## Notes

1. **HEIC Support**: HEIC format support depends on browser capabilities (primarily Safari)
2. **Canvas Operations**: May be slower on older mobile devices
3. **Memory Usage**: Large images are loaded into memory during processing
4. **Error Handling**: All async functions reject with Error objects on failure

## Testing

To verify the utilities work correctly, run the verification script in a browser console:

```typescript
import './lib/__verify-image-utils';
```

For proper unit testing, a test framework (e.g., Vitest, Jest) should be added to the project.
