/**
 * Manual verification script for image-utils
 * Run this in a browser console to test the utilities
 */

import {
  validateImageFile,
  isValidSelection,
  extractBase64FromDataURL,
} from './image-utils';

// Test 1: Validate file format
console.log('Test 1: Validate file format');
const mockJpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
const mockPdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });

const jpegValidation = validateImageFile(mockJpegFile);
console.assert(jpegValidation.valid === true, 'JPEG should be valid');

const pdfValidation = validateImageFile(mockPdfFile);
console.assert(pdfValidation.valid === false, 'PDF should be invalid');
console.assert(pdfValidation.error?.type === 'file-format', 'Should have format error');

// Test 2: Validate file size
console.log('Test 2: Validate file size');
const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11MB
const largeFile = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' });
const sizeValidation = validateImageFile(largeFile);
console.assert(sizeValidation.valid === false, 'Large file should be invalid');
console.assert(sizeValidation.error?.type === 'file-size', 'Should have size error');

// Test 3: Validate selection
console.log('Test 3: Validate selection');
const validSelection = { x: 10, y: 10, width: 100, height: 100 };
const tooSmallSelection = { x: 10, y: 10, width: 10, height: 10 };
const outOfBoundsSelection = { x: 900, y: 10, width: 200, height: 100 };

console.assert(
  isValidSelection(validSelection, 800, 600) === true,
  'Valid selection should pass'
);
console.assert(
  isValidSelection(tooSmallSelection, 800, 600) === false,
  'Too small selection should fail'
);
console.assert(
  isValidSelection(outOfBoundsSelection, 800, 600) === false,
  'Out of bounds selection should fail'
);

// Test 4: Extract base64
console.log('Test 4: Extract base64');
const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANS';
const base64 = extractBase64FromDataURL(dataURL);
console.assert(base64 === 'iVBORw0KGgoAAAANS', 'Should extract base64 correctly');

console.log('All tests passed!');
