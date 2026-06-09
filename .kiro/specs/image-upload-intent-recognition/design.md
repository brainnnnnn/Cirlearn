# Design Document

## Overview

This design document specifies the technical architecture for adding image upload and intent recognition capabilities to the K12 AI tutoring application. The feature extends the existing chat-based workflow to support visual input, enabling students to upload images of textbook pages or worksheets, select specific regions containing questions, and automatically extract text and subject intent through Vision Language Model (VLM) processing.

The implementation follows the existing architectural patterns:
- Next.js 16 App Router with React 19
- Streaming API routes with NDJSON responses
- Custom React hooks for state management
- Tailwind CSS for styling
- Component-based card UI system

### Product Pipeline Integration

This feature completes the left side of the product pipeline:

```
圈选识别 (image selection/OCR) → 意图识别 (intent recognition via VLM) → 内容生成 (existing)
     [NEW FEATURE]                        [NEW FEATURE]                     [CURRENT]
```

The right side (content generation with card-based responses) already exists and will be reused without modification.

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[ChatInterface Component]
        Upload[ImageUploadButton]
        Preview[ImagePreview Component]
        Selection[RegionSelector Component]
        Input[Chat Input Field]
    end
    
    subgraph "State Management"
        Hook[useStreamingChat Hook]
        ImageState[Image Upload State]
    end
    
    subgraph "API Layer"
        ChatAPI[/api/chat Route]
        VLM_API[/api/vlm Route NEW]
    end
    
    subgraph "External Services"
        Kimi[Kimi Vision API]
        GPT4V[GPT-4V API]
        LLM[Existing LLM Providers]
    end
    
    UI --> Upload
    Upload --> Preview
    Preview --> Selection
    Selection --> ImageState
    ImageState --> VLM_API
    VLM_API --> Kimi
    VLM_API --> GPT4V
    VLM_API --> ImageState
    ImageState --> Input
    Input --> Hook
    Hook --> ChatAPI
    ChatAPI --> LLM
    
    style VLM_API fill:#e1f5ff
    style Upload fill:#e1f5ff
    style Preview fill:#e1f5ff
    style Selection fill:#e1f5ff
    style ImageState fill:#e1f5ff
```

### Data Flow

```
1. User clicks upload button
   ↓
2. File selected → validated → base64 encoded
   ↓
3. Image displayed in preview component
   ↓
4. User draws selection rectangle
   ↓
5. Cropped image extracted from coordinates
   ↓
6. POST to /api/vlm with cropped image + API config
   ↓
7. VLM API processes image:
   - Extracts text via OCR
   - Classifies subject (math/chinese/english)
   ↓
8. Response: { questionText, subject, confidence }
   ↓
9. Populate chat input field with questionText
   ↓
10. User confirms → existing chat flow
   ↓
11. Chat API uses subject intent for prompt selection
   ↓
12. Streaming response with existing card UI
```

## Components and Interfaces

### New Components

#### 1. ImageUploadButton

**Purpose:** Entry point for image upload workflow

**Location:** `src/components/ImageUploadButton.tsx`

**Interface:**
```typescript
interface ImageUploadButtonProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
}
```

**Behavior:**
- Renders a button with camera/upload icon
- Opens file picker on click
- Supports direct camera capture on mobile (via `capture="environment"`)
- Validates file type (JPEG, PNG, WebP, HEIC)
- Validates file size (max 10MB)
- Emits onImageSelect event with validated File object

**Styling:** Consistent with existing send button styling (rounded-xl, border, hover states)

#### 2. ImagePreview

**Purpose:** Display uploaded image with selection capabilities

**Location:** `src/components/ImagePreview.tsx`

**Interface:**
```typescript
interface ImagePreviewProps {
  imageSrc: string; // data URL
  onRegionSelect: (croppedImage: string, coordinates: Rectangle) => void;
  onClose: () => void;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Behavior:**
- Displays image at readable resolution (max 800px width)
- Preserves aspect ratio
- Overlays RegionSelector component
- Provides close button to cancel workflow
- Responsive: adapts to mobile screen sizes

**Styling:** Modal overlay with backdrop blur, rounded corners, shadow

#### 3. RegionSelector

**Purpose:** Interactive selection tool for drawing rectangles

**Location:** `src/components/RegionSelector.tsx`

**Interface:**
```typescript
interface RegionSelectorProps {
  imageRef: React.RefObject<HTMLImageElement>;
  onSelectionComplete: (coordinates: Rectangle) => void;
}
```

**Behavior:**
- Mouse events: mousedown → mousemove → mouseup
- Touch events: touchstart → touchmove → touchend
- Draws visual overlay (dashed border, semi-transparent fill)
- Allows adjustment after initial selection (drag handles on corners)
- Extracts cropped region as base64 data URL
- Validates minimum selection size (20x20 pixels)

**Styling:** 
- Selection overlay: `border-2 border-dashed border-blue-500 bg-blue-500/20`
- Corner handles: `w-3 h-3 bg-blue-500 rounded-full`

#### 4. ExtractedTextConfirm

**Purpose:** Display extracted text with edit capability before sending

**Location:** `src/components/ExtractedTextConfirm.tsx`

**Interface:**
```typescript
interface ExtractedTextConfirmProps {
  extractedText: string;
  detectedSubject: 'math' | 'chinese' | 'english';
  confidence: number;
  onConfirm: (editedText: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}
```

**Behavior:**
- Shows extracted text in editable textarea
- Displays detected subject with confidence badge
- Provides three actions: Confirm, Edit & Confirm, Retry Selection
- If confidence < 0.7, shows warning badge

**Styling:** Card-based UI matching existing message cards

### Modified Components

#### ChatInterface (Modified)

**Location:** `src/components/ChatInterface.tsx`

**New State:**
```typescript
const [uploadedImage, setUploadedImage] = useState<string | null>(null);
const [croppedImage, setCroppedImage] = useState<string | null>(null);
const [extractedData, setExtractedData] = useState<{
  text: string;
  subject: string;
  confidence: number;
} | null>(null);
const [isProcessingImage, setIsProcessingImage] = useState(false);
const [showImagePreview, setShowImagePreview] = useState(false);
```

**New Functions:**
```typescript
async function handleImageSelect(file: File): Promise<void>;
async function handleRegionSelect(croppedImg: string, coords: Rectangle): Promise<void>;
async function processImageWithVLM(imageData: string): Promise<void>;
function handleExtractedTextConfirm(text: string): void;
```

**UI Changes:**
- Add ImageUploadButton next to send button
- Render ImagePreview modal when image selected
- Render ExtractedTextConfirm modal when text extracted
- Add loading indicator during VLM processing

### API Routes

#### /api/vlm (NEW)

**Purpose:** Handle VLM API calls for OCR and intent recognition

**Location:** `src/app/api/vlm/route.ts`

**Request Interface:**
```typescript
interface VLMRequest {
  image: string; // base64 encoded image
  provider: 'kimi' | 'gpt4v';
  apiKey: string;
  baseURL?: string; // optional custom endpoint
}
```

**Response Interface:**
```typescript
interface VLMResponse {
  success: boolean;
  data?: {
    extractedText: string;
    subject: 'math' | 'chinese' | 'english';
    confidence: number; // 0.0 to 1.0
  };
  error?: {
    message: string;
    code: string;
  };
}
```

**Implementation Details:**
- Runtime: `nodejs`
- Dynamic: `force-dynamic`
- Timeout: 60 seconds
- Error handling: network errors, API errors, invalid responses
- Fallback: if subject detection fails, return null subject (client falls back to text-based detection)

**VLM Provider Implementations:**

##### Kimi Vision API
```typescript
async function callKimiVision(
  imageData: string,
  apiKey: string,
  baseURL: string
): Promise<VLMResponse>
```

**Request Format:**
```json
{
  "model": "kimi-vision",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,..."
          }
        },
        {
          "type": "text",
          "text": "请识别图片中的文字内容，并判断这是数学、语文还是英语学科的题目。返回JSON格式: {\"text\": \"...\", \"subject\": \"math|chinese|english\", \"confidence\": 0.0-1.0}"
        }
      ]
    }
  ]
}
```

##### GPT-4V API
```typescript
async function callGPT4Vision(
  imageData: string,
  apiKey: string
): Promise<VLMResponse>
```

**Request Format:** Similar to Kimi but using OpenAI's endpoint format

**Prompt Strategy:**
- Request structured JSON output
- Ask for both OCR and subject classification in single call
- Include confidence score for subject detection
- Handle Chinese, English text recognition

#### /api/chat (MODIFIED)

**Location:** `src/app/api/chat/route.ts`

**Modified Request Interface:**
```typescript
interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  apiKey: string;
  baseURL?: string;
  subjectOverride?: 'math' | 'chinese' | 'english'; // NEW
}
```

**Implementation Changes:**
```typescript
export async function POST(req: Request) {
  const { messages, model, apiKey, baseURL, subjectOverride } = await req.json();
  
  // Use subjectOverride if provided, otherwise detect from text
  const subject = subjectOverride ?? detectSubject(messages);
  const systemPrompt = getSystemPrompt(subject);
  
  // ... rest of existing logic
}
```

**Behavior:**
- If `subjectOverride` is provided, use it directly (skip text-based detection)
- Otherwise, fall back to existing `detectSubject()` function
- This ensures VLM-detected subject takes precedence over keyword matching

## Data Models

### ImageUploadState

**Purpose:** Client-side state for image upload workflow

```typescript
interface ImageUploadState {
  // Current workflow stage
  stage: 'idle' | 'uploaded' | 'selecting' | 'processing' | 'extracted' | 'confirmed';
  
  // Image data
  originalImage: {
    file: File;
    dataUrl: string;
    width: number;
    height: number;
  } | null;
  
  croppedImage: {
    dataUrl: string;
    coordinates: Rectangle;
  } | null;
  
  // Extraction results
  extractedData: {
    text: string;
    subject: 'math' | 'chinese' | 'english';
    confidence: number;
  } | null;
  
  // UI state
  isProcessing: boolean;
  error: string | null;
}
```

### VLMProviderConfig

**Purpose:** Configuration for VLM API providers

```typescript
interface VLMProviderConfig {
  provider: 'kimi' | 'gpt4v';
  apiKey: string;
  baseURL?: string;
  model?: string; // optional model override
}
```

### Rectangle

**Purpose:** Selection coordinates

```typescript
interface Rectangle {
  x: number;      // pixels from left
  y: number;      // pixels from top
  width: number;  // pixels
  height: number; // pixels
}
```

## State Management

### Image Upload Hook

**Location:** `src/hooks/useImageUpload.ts`

```typescript
export function useImageUpload() {
  const [state, setState] = useState<ImageUploadState>({
    stage: 'idle',
    originalImage: null,
    croppedImage: null,
    extractedData: null,
    isProcessing: false,
    error: null,
  });

  const uploadImage = useCallback(async (file: File) => {
    // Validate file
    // Convert to data URL
    // Update state
  }, []);

  const selectRegion = useCallback(async (
    coordinates: Rectangle
  ) => {
    // Extract cropped region
    // Update state
  }, [state.originalImage]);

  const processWithVLM = useCallback(async (
    config: VLMProviderConfig
  ) => {
    // Call /api/vlm
    // Update state with results
  }, [state.croppedImage]);

  const reset = useCallback(() => {
    setState({
      stage: 'idle',
      originalImage: null,
      croppedImage: null,
      extractedData: null,
      isProcessing: false,
      error: null,
    });
  }, []);

  return {
    state,
    uploadImage,
    selectRegion,
    processWithVLM,
    reset,
  };
}
```

### Integration with useStreamingChat

The existing `useStreamingChat` hook does not need modification. Instead:

1. Image upload hook manages image processing workflow
2. When extraction completes, populate the chat input field
3. User confirms → call `sendMessage()` with extracted text + subject override
4. Modify ChatInterface to pass `subjectOverride` to API

**Flow:**
```typescript
// In ChatInterface.tsx
const { state: imageState, processWithVLM } = useImageUpload();
const { sendMessage } = useStreamingChat('/api/chat');

async function handleExtractedTextConfirm(text: string) {
  // Send to chat with subject override
  await sendMessage(text, {
    apiKey,
    model,
    baseURL,
    subjectOverride: imageState.extractedData?.subject,
  });
  
  // Reset image upload state
  imageState.reset();
}
```

**Modification to useStreamingChat:**
```typescript
// Add subjectOverride to config parameter
const sendMessage = useCallback(async (
  userContent: string,
  config: { 
    apiKey: string; 
    model: string; 
    baseURL?: string;
    subjectOverride?: string; // NEW
  },
) => {
  // ... existing logic
  
  body: JSON.stringify({
    messages: nextMessages.map(m => ({ ... })),
    model: config.model,
    apiKey: config.apiKey,
    subjectOverride: config.subjectOverride, // NEW
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  }),
}, [messages, apiPath]);
```

## Error Handling

### Error Categories

#### 1. File Upload Errors

**Scenarios:**
- File size exceeds 10MB
- Unsupported file format
- File read error

**Handling:**
- Display inline error message below upload button
- Clear error after 5 seconds
- Allow user to retry with different file

**UI:**
```typescript
<div className="text-xs text-destructive mt-1">
  {error.type === 'file-size' && '图片大小不能超过10MB，请选择更小的图片'}
  {error.type === 'file-format' && '不支持的文件格式，请选择JPG、PNG或WebP图片'}
  {error.type === 'file-read' && '无法读取文件，请重试'}
</div>
```

#### 2. VLM API Errors

**Scenarios:**
- Network timeout
- API rate limit
- Invalid API key
- VLM service unavailable
- Empty response (no text detected)

**Handling:**
- Display error in modal overlay
- Provide "Retry" and "Manual Entry" options
- Preserve uploaded image for retry
- Log error details to console for debugging

**UI:**
```typescript
<div className="rounded-xl bg-destructive/8 border border-destructive/20 p-4">
  <div className="flex items-start gap-2">
    <span className="text-destructive">⚠️</span>
    <div className="flex-1">
      <p className="text-sm font-medium text-destructive mb-1">识别失败</p>
      <p className="text-xs text-destructive/80">{errorMessage}</p>
      <div className="flex gap-2 mt-3">
        <button onClick={retry} className="text-xs px-3 py-1.5 rounded bg-destructive/10 hover:bg-destructive/20">
          重试
        </button>
        <button onClick={manualEntry} className="text-xs px-3 py-1.5 rounded bg-muted hover:bg-muted/80">
          手动输入
        </button>
      </div>
    </div>
  </div>
</div>
```

#### 3. Selection Errors

**Scenarios:**
- Selection too small (< 20x20 pixels)
- Selection outside image bounds

**Handling:**
- Show inline warning message
- Prevent "Confirm" action until valid selection
- Provide visual feedback (red border on invalid selection)

**UI:**
```typescript
{selection && !isValidSelection(selection) && (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
    选区太小，请重新选择
  </div>
)}
```

#### 4. Low Confidence Detection

**Scenarios:**
- Subject confidence < 0.7
- Ambiguous text (mixed subjects)

**Handling:**
- Show warning badge on ExtractedTextConfirm
- Allow user to proceed anyway (fallback to text-based detection)
- Display detected subject as suggestion, not mandate

**UI:**
```typescript
{confidence < 0.7 && (
  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
    <span>⚠️</span>
    <span>学科识别不确定，将根据问题内容智能判断</span>
  </div>
)}
```

### Error Recovery Strategy

1. **Graceful Degradation:** If VLM fails, allow manual text entry
2. **State Preservation:** Keep uploaded image in state for retry
3. **Fallback Chain:** VLM subject → text-based detection → default (Chinese)
4. **User Control:** Always provide manual override options

### Error Logging

```typescript
// Log VLM errors with context
function logVLMError(error: Error, context: {
  provider: string;
  hasApiKey: boolean;
  imageSize: number;
}) {
  console.error('[VLM Error]', {
    message: error.message,
    provider: context.provider,
    hasApiKey: context.hasApiKey,
    imageSizeKB: Math.round(context.imageSize / 1024),
    timestamp: new Date().toISOString(),
  });
}
```

## Testing Strategy

### Unit Tests

**Target Files:**
- `src/hooks/useImageUpload.ts` - state transitions, validation logic
- `src/app/api/vlm/route.ts` - VLM provider functions, error handling
- `src/lib/image-utils.ts` - image processing utilities (crop, resize, encode)

**Example Tests:**

```typescript
// useImageUpload.test.ts
describe('useImageUpload', () => {
  it('should validate file size', async () => {
    // Create 11MB file mock
    // Expect error
  });
  
  it('should convert file to base64', async () => {
    // Upload valid file
    // Expect dataUrl in state
  });
  
  it('should extract cropped region', async () => {
    // Set original image
    // Call selectRegion with coordinates
    // Expect croppedImage in state
  });
});

// vlm/route.test.ts
describe('/api/vlm', () => {
  it('should return error for missing API key', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ image: 'data:...', provider: 'kimi' }),
    }));
    expect(response.status).toBe(400);
  });
  
  it('should handle Kimi Vision API success', async () => {
    // Mock fetch to return valid response
    // Expect structured VLMResponse
  });
  
  it('should handle API timeout', async () => {
    // Mock fetch to timeout
    // Expect error response with timeout code
  });
});
```

### Integration Tests

**Target Flows:**
- Complete image upload → selection → extraction → chat workflow
- VLM API integration with real endpoints (using test API keys)
- Subject override propagation through chat API

**Example Tests:**

```typescript
describe('Image Upload Flow', () => {
  it('should complete full workflow', async () => {
    // 1. Upload image
    // 2. Draw selection
    // 3. Process with VLM (mocked)
    // 4. Confirm extracted text
    // 5. Verify chat message created with subject override
  });
  
  it('should fallback to text detection on VLM failure', async () => {
    // 1. Upload image
    // 2. Process with VLM (mock failure)
    // 3. User enters text manually
    // 4. Send to chat
    // 5. Verify text-based subject detection used
  });
});
```

### Manual Testing Checklist

**Mobile Testing:**
- [ ] Camera capture works on iOS Safari
- [ ] Camera capture works on Android Chrome
- [ ] Touch selection works smoothly
- [ ] Layout adapts to portrait/landscape
- [ ] Image preview fits screen

**Desktop Testing:**
- [ ] File picker works on Chrome, Firefox, Safari
- [ ] Mouse selection draws accurately
- [ ] Keyboard shortcuts work (Esc to cancel)
- [ ] Dark mode renders correctly

**API Testing:**
- [ ] Kimi Vision API with valid key
- [ ] GPT-4V API with valid key
- [ ] Custom endpoint with baseURL
- [ ] Rate limiting handling
- [ ] Timeout handling

**Edge Cases:**
- [ ] Very large images (9.9MB)
- [ ] Very small selections
- [ ] Images with no text
- [ ] Images with mixed languages
- [ ] Rotated/skewed images
- [ ] Low quality images

### Test Data

**Sample Images:**
- `test/fixtures/math-problem.jpg` - Clear math equation
- `test/fixtures/chinese-text.jpg` - Chinese text paragraph
- `test/fixtures/english-worksheet.jpg` - English grammar question
- `test/fixtures/mixed-content.jpg` - Multiple subjects on same page
- `test/fixtures/blurry.jpg` - Low quality image
- `test/fixtures/rotated.jpg` - 90-degree rotated image

## Implementation Notes

### Performance Considerations

1. **Image Compression:** Resize images client-side before sending to VLM API to reduce bandwidth
2. **Debouncing:** Debounce selection rectangle updates during dragging to prevent excessive re-renders
3. **Lazy Loading:** Load RegionSelector component only when image is uploaded
4. **Canvas Optimization:** Use OffscreenCanvas for cropping operations when available

### Browser Compatibility

**Target Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

**Polyfills Needed:**
- None (all features supported in target browsers)

**Known Limitations:**
- HEIC format requires browser support (Safari only) or server-side conversion
- Canvas operations may be slower on older mobile devices

### Accessibility

**Keyboard Navigation:**
- Upload button: focusable, Enter/Space to trigger
- Selection tool: Arrow keys to adjust selection
- Confirm modal: Tab navigation, Enter to confirm, Esc to cancel

**Screen Reader Support:**
- Upload button: "Upload image" label
- Selection area: "Draw selection by clicking and dragging"
- Extracted text: "Extracted text: [text]"

**ARIA Attributes:**
```typescript
<button
  aria-label="上传图片"
  aria-describedby="upload-hint"
  onClick={handleUpload}
>
  {/* ... */}
</button>

<div
  role="dialog"
  aria-labelledby="preview-title"
  aria-modal="true"
>
  {/* ... */}
</div>
```

### Security Considerations

1. **API Key Storage:** Store in sessionStorage (not localStorage) to reduce XSS risk
2. **Image Data Sanitization:** Validate MIME type on both client and server
3. **CSP Headers:** Ensure VLM API domains are whitelisted for fetch requests
4. **Rate Limiting:** Implement client-side request throttling (max 3 requests per minute)
5. **Data URLs:** Limit size to prevent memory exhaustion attacks

### Configuration

**Environment Variables (.env.local):**
```bash
# Optional: Default VLM provider
NEXT_PUBLIC_DEFAULT_VLM_PROVIDER=kimi

# Optional: VLM API endpoints
NEXT_PUBLIC_KIMI_VISION_ENDPOINT=https://api.moonshot.cn/v1
NEXT_PUBLIC_GPT4V_ENDPOINT=https://api.openai.com/v1

# Optional: Feature flags
NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD=true
NEXT_PUBLIC_ENABLE_CAMERA_CAPTURE=true
```

**Settings UI Addition:**
```typescript
// Add to settings modal in ChatInterface
<div className="flex flex-col gap-1">
  <label className="text-[11px] text-muted-foreground">图片识别服务</label>
  <select
    value={vlmProvider}
    onChange={e => setVLMProvider(e.target.value)}
    className="w-full text-xs px-2.5 py-1.5 rounded border border-border/50 bg-background"
  >
    <option value="kimi">Kimi Vision（推荐）</option>
    <option value="gpt4v">GPT-4V</option>
  </select>
</div>
```

## Migration and Rollout

### Phase 1: Foundation (Week 1)
- Create image upload components (button, preview, selector)
- Implement useImageUpload hook
- Add image validation and processing utilities
- Unit tests for utilities

### Phase 2: VLM Integration (Week 1-2)
- Implement /api/vlm route
- Add Kimi Vision API integration
- Add GPT-4V API integration
- Error handling and fallbacks
- API integration tests

### Phase 3: Chat Integration (Week 2)
- Modify ChatInterface to include upload flow
- Add ExtractedTextConfirm component
- Integrate subjectOverride in chat API
- Connect all components together

### Phase 4: Testing and Polish (Week 2-3)
- Mobile testing and optimization
- Dark mode refinement
- Accessibility audit
- Performance optimization
- Documentation

### Phase 5: Rollout (Week 3)
- Feature flag enabled for internal testing
- Beta release to select users
- Monitor error rates and performance
- Full release

## Future Enhancements

### Post-MVP Features

1. **Multi-Region Selection:** Select multiple questions from same image
2. **Image History:** Show recently uploaded images for quick re-selection
3. **OCR Editing:** Visual editor to correct OCR mistakes
4. **Batch Processing:** Upload multiple images at once
5. **Offline OCR:** Use local Tesseract.js as fallback when API unavailable
6. **Image Annotation:** Draw arrows, highlight text before sending

### Performance Optimization

1. **WebAssembly OCR:** Embed lightweight OCR model for instant preview
2. **Image CDN:** Store uploaded images temporarily for retry/history
3. **Service Worker:** Cache VLM responses for duplicate images
4. **WebRTC:** Peer-to-peer image transfer for large files

### Analytics

Track these metrics:
- Image upload success rate
- VLM API success rate by provider
- Average processing time
- Subject detection accuracy
- User retry rate
- Manual entry fallback rate

