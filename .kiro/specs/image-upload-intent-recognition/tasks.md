# Implementation Plan: Image Upload and Intent Recognition

## Overview

This implementation plan breaks down the image upload and intent recognition feature into discrete, executable tasks. The feature enables students to upload images of textbook pages or worksheets, select specific regions containing questions, and automatically extract text and subject intent through Vision Language Model (VLM) processing.

The implementation follows a phased approach:
1. **Foundation**: Core utilities and data structures
2. **Image Upload Flow**: Upload button, preview, region selection
3. **VLM Integration**: API route and provider implementations
4. **Chat Integration**: Connect image workflow to existing chat
5. **Polish**: Error handling, mobile optimization, testing

## Tasks

- [x] 1. Set up image processing utilities and types
  - Create `src/lib/image-utils.ts` with image validation, base64 encoding, and cropping utilities
  - Define TypeScript interfaces for `Rectangle`, `ImageUploadState`, `VLMProviderConfig`, and `VLMResponse` in `src/types/image-upload.ts`
  - Implement file validation (format, size limits)
  - Implement image resizing and compression functions
  - _Requirements: 1.2, 1.3, 9.1, 9.2, 9.3, 9.4_

- [ ]* 1.1 Write unit tests for image utilities
  - Test file validation (valid/invalid formats, size limits)
  - Test base64 encoding
  - Test image resizing and cropping
  - Test error cases (invalid files, missing data)
  - _Requirements: 1.2, 1.5, 9.1, 9.2_

- [x] 2. Create ImageUploadButton component
  - [x] 2.1 Create `src/components/ImageUploadButton.tsx` with file picker integration
    - Implement button with camera/upload icon
    - Add file input with `accept="image/jpeg,image/png,image/webp,image/heic"`
    - Support mobile camera capture with `capture="environment"`
    - Emit `onImageSelect` event with validated File object
    - Style consistently with existing send button (rounded-xl, border, hover states)
    - _Requirements: 1.1, 10.1_
  
  - [x] 2.2 Add file validation and error handling
    - Validate file type and size on selection
    - Display inline error messages for invalid files
    - Auto-clear errors after 5 seconds
    - _Requirements: 1.2, 1.5, 7.1, 9.1_

- [ ]* 2.3 Write component tests for ImageUploadButton
  - Test file selection trigger
  - Test validation for various file types and sizes
  - Test error message display
  - Test mobile camera capture attribute
  - _Requirements: 1.1, 1.2, 1.5, 10.1_

- [x] 3. Create RegionSelector component
  - [x] 3.1 Implement `src/components/RegionSelector.tsx` with drawing functionality
    - Handle mouse events: mousedown → mousemove → mouseup
    - Handle touch events: touchstart → touchmove → touchend
    - Draw visual overlay (dashed border, semi-transparent fill)
    - Validate minimum selection size (20x20 pixels)
    - Extract cropped region as base64 data URL using canvas
    - _Requirements: 2.1, 2.2, 2.5, 10.2_
  
  - [x] 3.2 Add selection adjustment capability
    - Render corner handles for adjusting selection
    - Allow dragging handles to resize selection
    - Prevent selection from exceeding image bounds
    - _Requirements: 2.3, 2.4_

- [ ]* 3.3 Write tests for RegionSelector
  - Test mouse drawing workflow
  - Test touch event handling
  - Test selection validation (size, bounds)
  - Test cropping extraction
  - _Requirements: 2.1, 2.2, 2.5, 10.2_

- [x] 4. Create ImagePreview component
  - Create `src/components/ImagePreview.tsx` with modal layout
  - Display uploaded image at readable resolution (max 800px width)
  - Preserve image aspect ratio
  - Overlay RegionSelector component
  - Add close button to cancel workflow
  - Implement responsive layout for mobile screens
  - Style with modal overlay, backdrop blur, rounded corners, shadow
  - _Requirements: 1.3, 1.4, 2.1, 10.3, 10.4_

- [ ]* 4.1 Write tests for ImagePreview
  - Test image display and scaling
  - Test close button functionality
  - Test RegionSelector integration
  - Test responsive behavior
  - _Requirements: 1.3, 1.4, 2.1, 10.3, 10.4_

- [~] 5. Checkpoint - Verify UI components render correctly
  - Ensure all components render without errors
  - Test image upload → preview → selection workflow manually
  - Verify responsive behavior on different screen sizes
  - Ask the user if questions arise.

- [x] 6. Implement VLM API route
  - [x] 6.1 Create `src/app/api/vlm/route.ts` with request/response handling
    - Set up POST handler with Next.js App Router patterns
    - Parse `VLMRequest` from request body
    - Validate required fields (image, provider, apiKey)
    - Return structured `VLMResponse` JSON
    - Configure runtime: `nodejs`, dynamic: `force-dynamic`
    - _Requirements: 3.1, 3.2, 6.1, 6.5_
  
  - [x] 6.2 Implement Kimi Vision API integration
    - Create `callKimiVision()` function
    - Format request with image_url and OCR + subject classification prompt
    - Parse JSON response for extracted text and subject
    - Handle API errors (network, auth, invalid response)
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 6.2, 6.4_
  
  - [x] 6.3 Implement GPT-4V API integration
    - Create `callGPT4Vision()` function
    - Format request using OpenAI's vision endpoint format
    - Use same prompt strategy as Kimi for consistency
    - Parse response and extract structured data
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 6.3, 6.4_
  
  - [x] 6.4 Add comprehensive error handling
    - Handle timeout (60 seconds)
    - Handle network errors
    - Handle API authentication errors
    - Handle empty/invalid responses
    - Return user-friendly error messages with error codes
    - Log errors with context for debugging
    - _Requirements: 3.5, 7.2, 7.3_

- [ ]* 6.5 Write integration tests for VLM API route
  - Test request validation (missing fields)
  - Test Kimi Vision API success and error cases (mocked)
  - Test GPT-4V API success and error cases (mocked)
  - Test timeout handling
  - Test error response formatting
  - _Requirements: 3.1, 3.2, 3.5, 6.1, 6.5, 7.2_

- [x] 7. Create useImageUpload hook
  - Create `src/hooks/useImageUpload.ts` with state management
  - Define `ImageUploadState` interface with stage tracking
  - Implement `uploadImage()` function (validate, convert to data URL, update state)
  - Implement `selectRegion()` function (extract cropped region, update state)
  - Implement `processWithVLM()` function (call /api/vlm, handle response)
  - Implement `reset()` function (clear all state)
  - Return state and actions from hook
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 7.5_

- [ ]* 7.1 Write tests for useImageUpload hook
  - Test state transitions through workflow stages
  - Test uploadImage with valid/invalid files
  - Test selectRegion with various coordinates
  - Test processWithVLM success and error cases (mocked)
  - Test reset functionality
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 7.5_

- [~] 8. Checkpoint - Verify backend integration
  - Test VLM API route with Postman or curl
  - Verify Kimi Vision API with real API key
  - Verify GPT-4V API with real API key (if available)
  - Confirm error handling works as expected
  - Ask the user if questions arise.

- [x] 9. Create ExtractedTextConfirm component
  - Create `src/components/ExtractedTextConfirm.tsx` with confirmation UI
  - Display extracted text in editable textarea
  - Show detected subject with confidence badge
  - Add confidence warning badge if confidence < 0.7
  - Provide three actions: Confirm, Edit & Confirm, Retry Selection
  - Style as card-based UI matching existing message cards
  - _Requirements: 5.2, 8.3_

- [ ]* 9.1 Write tests for ExtractedTextConfirm
  - Test text display and editing
  - Test confidence badge rendering
  - Test low confidence warning
  - Test action buttons (Confirm, Retry)
  - _Requirements: 5.2, 8.3_

- [x] 10. Integrate image upload into ChatInterface
  - [x] 10.1 Add image upload state to ChatInterface
    - Import useImageUpload hook
    - Add state for VLM provider config (from settings)
    - Add loading indicator for VLM processing
    - _Requirements: 5.1, 6.1_
  
  - [x] 10.2 Add ImageUploadButton to input area
    - Position button next to send button
    - Wire up `onImageSelect` handler
    - Disable during loading states
    - _Requirements: 8.1_
  
  - [x] 10.3 Conditionally render ImagePreview modal
    - Show when image uploaded (stage: 'uploaded' or 'selecting')
    - Wire up `onRegionSelect` handler to trigger VLM processing
    - Wire up `onClose` handler to reset state
    - _Requirements: 1.3, 2.1, 8.2_
  
  - [x] 10.4 Conditionally render ExtractedTextConfirm modal
    - Show when extraction completes (stage: 'extracted')
    - Wire up `onConfirm` handler to populate chat input
    - Wire up `onRetry` handler to return to selection
    - Wire up `onCancel` handler to reset workflow
    - _Requirements: 5.2, 8.3_

- [x] 11. Modify useStreamingChat hook for subject override
  - Update `sendMessage()` function signature to accept optional `subjectOverride` parameter
  - Pass `subjectOverride` in request body to /api/chat
  - Preserve backward compatibility (subjectOverride is optional)
  - _Requirements: 5.3, 5.4_

- [x] 12. Modify /api/chat route to support subject override
  - Update request interface to include optional `subjectOverride` field
  - Use `subjectOverride` if provided, otherwise fall back to `detectSubject()` function
  - Pass detected/overridden subject to `getSystemPrompt()` function
  - Ensure existing behavior unchanged when `subjectOverride` not provided
  - _Requirements: 4.4, 5.4_

- [ ] 13. Connect extraction result to chat flow
  - In `ExtractedTextConfirm.onConfirm`, populate chat input field with extracted text
  - Call `sendMessage()` with extracted text and `subjectOverride` from VLM result
  - Reset image upload state after message sent
  - Preserve conversation context during image workflow
  - _Requirements: 5.1, 5.3, 5.5, 8.4_

- [~] 14. Checkpoint - Test complete image-to-chat workflow
  - Test: upload → select → extract → confirm → chat response
  - Verify subject override is used for prompt selection
  - Verify extracted text populates input correctly
  - Verify existing text input still works
  - Ask the user if questions arise.

- [~] 15. Add VLM provider settings to ChatInterface
  - Add VLM provider dropdown to settings modal (Kimi Vision, GPT-4V)
  - Store VLM provider preference in localStorage
  - Add optional VLM API key field (separate from chat API key)
  - Add optional VLM base URL field for custom endpoints
  - Pass VLM config to `processWithVLM()` function
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [~] 16. Implement mobile-specific optimizations
  - Test and adjust touch event handling on mobile devices
  - Optimize layout for portrait and landscape orientations
  - Test camera capture on iOS Safari and Android Chrome
  - Adjust image preview sizing for small screens
  - Test selection tool on mobile with various screen sizes
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [~] 17. Add loading states and visual feedback
  - Show loading spinner during file upload
  - Show loading overlay during VLM processing with progress message
  - Add visual feedback for touch interactions (ripple effect)
  - Show success animation when extraction completes
  - Display clear stage indicators throughout workflow
  - _Requirements: 8.2_

- [ ] 18. Implement comprehensive error handling UI
  - Add error display component with retry options
  - Implement "Manual Entry" fallback when VLM fails
  - Preserve uploaded image for retry after error
  - Add error logging with context for debugging
  - Test all error scenarios (file errors, API errors, network errors)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 18.1 Write integration tests for error handling
  - Test file upload errors (size, format)
  - Test VLM API errors (timeout, auth, empty response)
  - Test selection errors (too small, out of bounds)
  - Test fallback to manual entry
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [~] 19. Add accessibility features
  - Add ARIA labels to all interactive elements
  - Ensure keyboard navigation works for all components
  - Add screen reader support for image upload workflow
  - Test tab navigation through entire flow
  - Add focus indicators for keyboard users
  - _Requirements: 8.1, 8.2, 8.3_

- [~] 20. Final checkpoint - End-to-end testing
  - Test complete workflow on desktop (Chrome, Firefox, Safari)
  - Test complete workflow on mobile (iOS Safari, Android Chrome)
  - Test with various image types and sizes
  - Test error recovery paths
  - Test dark mode rendering
  - Verify all requirements are met
  - Ask the user if questions arise.

## Task Dependency Graph

```
1 → 2
2 → 2.1, 2.2
2.1, 2.2 → 3
3 → 3.1, 3.2
3.1, 3.2 → 4
4 → 5
5 → 6
6 → 6.1, 6.2, 6.3, 6.4
6.1, 6.2, 6.3, 6.4 → 7
7 → 8
8 → 9
9 → 10
10 → 10.1, 10.2, 10.3, 10.4
10.1, 10.2, 10.3, 10.4 → 11
11 → 12
12 → 13
13 → 14
14 → 15, 16, 17, 18, 19
15, 16, 17, 18, 19 → 20
```

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP delivery
- Each task references specific requirements from the requirements document for traceability
- The workflow is designed to be incremental - each phase builds on the previous one
- Checkpoints ensure the implementation is validated before proceeding to the next phase
- VLM API keys should be stored in sessionStorage (not localStorage) for security
- The feature uses TypeScript throughout for type safety
- All styling follows existing Tailwind CSS patterns and design system
- The implementation reuses existing chat components and hooks where possible
