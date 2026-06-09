# Requirements Document

## Introduction

This document specifies the requirements for adding image upload and intent recognition capabilities to the K12 AI tutoring application. The feature enables students to upload images of textbook pages or worksheets, select specific regions containing questions (simulating the "circling" action on learning devices), and automatically extract question text and subject intent through Vision Language Model (VLM) processing. This completes the left side of the product pipeline: **圈选识别 (image selection/OCR) → 意图识别 (intent recognition via VLM) → 内容生成 (existing)**.

## Glossary

- **System**: The K12 AI tutoring web application
- **User**: K12 student interacting with the tutoring application
- **VLM**: Vision Language Model capable of processing images and extracting text and semantic information
- **Selection_Tool**: UI component that allows users to draw selection rectangles on uploaded images
- **Image_Upload_Component**: UI component that handles image file selection and display
- **OCR**: Optical Character Recognition - extracting text from images
- **Intent_Classifier**: Component that determines the subject (math/chinese/english) from extracted content
- **Chat_API**: Existing `/api/chat` endpoint that processes text queries
- **Cropped_Image**: The extracted rectangular region selected by the user from the full image
- **Question_Text**: Text content extracted from the cropped image via VLM
- **Subject_Intent**: The detected subject category (math, chinese, or english)

## Requirements

### Requirement 1: Image Upload

**User Story:** As a student, I want to upload an image of my textbook or worksheet, so that I can ask questions about content in the image.

#### Acceptance Criteria

1. WHEN a user clicks the upload button, THE Image_Upload_Component SHALL open a file selection dialog
2. WHEN a user selects an image file, THE System SHALL validate that the file is an image format (JPEG, PNG, WebP, HEIC)
3. WHEN an image file is validated, THE System SHALL display the full image in the UI at readable resolution
4. WHEN an image is displayed, THE System SHALL preserve the original aspect ratio
5. IF the selected file is not an image format, THEN THE System SHALL display an error message and prevent upload

### Requirement 2: Region Selection

**User Story:** As a student, I want to select a specific region of the uploaded image, so that I can focus on a particular question or section.

#### Acceptance Criteria

1. WHEN an image is displayed, THE Selection_Tool SHALL allow the user to draw a rectangular selection by clicking and dragging
2. WHEN a user drags to create a selection, THE System SHALL display a visual overlay showing the selected region
3. WHEN a selection is created, THE System SHALL allow the user to adjust the selection boundaries
4. WHEN a user creates a new selection, THE System SHALL replace any previous selection
5. WHEN a user confirms the selection, THE System SHALL extract the Cropped_Image from the selected coordinates

### Requirement 3: Image Processing and OCR

**User Story:** As a student, I want the system to extract text from my selected image region, so that I don't have to type the question manually.

#### Acceptance Criteria

1. WHEN a user confirms a region selection, THE System SHALL send the Cropped_Image to a VLM API endpoint
2. WHEN the VLM API receives the Cropped_Image, THE System SHALL request text extraction via OCR
3. WHEN the VLM API returns results, THE System SHALL extract the Question_Text from the response
4. WHEN Question_Text is extracted, THE System SHALL display the extracted text in the chat input field
5. IF the VLM API returns an error, THEN THE System SHALL display a user-friendly error message and allow manual text entry

### Requirement 4: Intent Recognition

**User Story:** As a student, I want the system to automatically detect the subject of my question, so that I receive responses tailored to that subject.

#### Acceptance Criteria

1. WHEN the VLM API receives the Cropped_Image, THE System SHALL request subject classification analysis
2. WHEN analyzing the image, THE Intent_Classifier SHALL classify the content as math, chinese, or english
3. WHEN the Subject_Intent is determined, THE System SHALL store the detected subject for the query
4. WHEN generating a response, THE Chat_API SHALL use the Subject_Intent to select the appropriate system prompt
5. IF the Subject_Intent cannot be determined with confidence, THEN THE System SHALL fall back to text-based subject detection

### Requirement 5: Integration with Existing Chat Flow

**User Story:** As a student, I want the extracted question to automatically trigger the tutoring response, so that I get immediate help.

#### Acceptance Criteria

1. WHEN Question_Text and Subject_Intent are both available, THE System SHALL populate the chat input field with the Question_Text
2. WHEN the chat input is populated, THE System SHALL display a confirmation UI allowing the user to review before sending
3. WHEN the user confirms, THE Chat_API SHALL receive both the Question_Text and the Subject_Intent
4. WHEN the Chat_API processes the query, THE System SHALL use the Subject_Intent to override text-based subject detection
5. WHEN a response is generated, THE System SHALL display it using the existing card-based UI components

### Requirement 6: VLM API Configuration

**User Story:** As a user, I want to configure which VLM service to use, so that I can choose between different providers.

#### Acceptance Criteria

1. THE System SHALL support configuration of VLM API endpoints through the settings interface
2. THE System SHALL support Kimi Vision API as the default VLM provider
3. THE System SHALL support GPT-4V (OpenAI) as an alternative VLM provider
4. WHEN a VLM provider is selected, THE System SHALL use the appropriate API endpoint and request format
5. WHEN making VLM API calls, THE System SHALL include the user's API key for authentication

### Requirement 7: Error Handling and Fallbacks

**User Story:** As a user, I want clear error messages when image processing fails, so that I know what went wrong and can take corrective action.

#### Acceptance Criteria

1. IF an image upload fails, THEN THE System SHALL display the reason for failure
2. IF the VLM API is unavailable, THEN THE System SHALL display an error message and allow manual text entry
3. IF the VLM API returns no text, THEN THE System SHALL prompt the user to adjust the selection or enter text manually
4. IF intent recognition fails, THEN THE System SHALL fall back to the existing text-based subject detection
5. WHEN an error occurs, THE System SHALL preserve the uploaded image and selection for retry

### Requirement 8: User Experience and Workflow

**User Story:** As a student, I want a smooth workflow from image upload to getting an answer, so that I can quickly get help with my homework.

#### Acceptance Criteria

1. THE System SHALL provide a clear visual indicator for the image upload entry point
2. WHEN processing an image, THE System SHALL display loading states for each step (upload, OCR, intent detection)
3. WHEN extraction completes, THE System SHALL allow the user to edit the extracted text before sending
4. THE System SHALL maintain the existing text input workflow as an alternative to image upload
5. WHEN switching between text and image input modes, THE System SHALL preserve the current conversation context

### Requirement 9: Image Format and Size Handling

**User Story:** As a user, I want to upload images of various sizes and formats, so that I can use photos taken from my phone or screenshots.

#### Acceptance Criteria

1. THE System SHALL accept images up to 10MB in size
2. WHEN an image exceeds 10MB, THE System SHALL compress the image before processing
3. THE System SHALL support JPEG, PNG, WebP, and HEIC image formats
4. WHEN processing large images, THE System SHALL resize them for display while preserving quality for OCR
5. THE Cropped_Image SHALL be encoded in a format compatible with the selected VLM API

### Requirement 10: Mobile and Responsive Design

**User Story:** As a student using a mobile device, I want the image upload feature to work on my phone, so that I can photograph questions directly.

#### Acceptance Criteria

1. THE Image_Upload_Component SHALL support direct camera capture on mobile devices
2. THE Selection_Tool SHALL support touch gestures for drawing and adjusting selections
3. WHEN accessed on mobile, THE System SHALL optimize the layout for smaller screens
4. THE System SHALL display uploaded images at appropriate sizes for different screen widths
5. WHEN processing images on mobile, THE System SHALL provide clear visual feedback for touch interactions
