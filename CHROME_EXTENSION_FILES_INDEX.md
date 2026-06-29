# Chrome Extension Integration - File Structure & Components

## Complete Project Structure

```
genpuzzle/
├── chrome-extension/                          # Chrome Extension (Manifest V3)
│   ├── manifest.json                          # Extension config
│   ├── background.js                          # Service worker (message relay)
│   ├── content.js                             # Gemini automation & text extraction
│   └── README.md                              # Extension documentation
│
├── src/
│   ├── lib/
│   │   ├── genpuzzle-extension-integration.ts # React hooks & API (NEW)
│   │   └── ... (other libs)
│   │
│   └── components/
│       ├── WordSearchSidebar.tsx              # Updated with Generate button
│       └── ... (other components)
│
└── Documentation/
    ├── CHROME_EXTENSION_COMPLETE_GUIDE.md     # Full specification (NEW)
    ├── CHROME_EXTENSION_QUICK_REFERENCE.md    # Quick reference (NEW)
    └── CHROME_EXTENSION_PRODUCTION_READY.md   # Production guide (NEW)
```

---

## Component Descriptions

### 1. Extension Files

#### **chrome-extension/manifest.json**
- **Type:** Configuration file
- **Purpose:** Defines extension metadata, permissions, scripts
- **Key Settings:**
  - `manifest_version: 3` (Manifest V3)
  - `permissions: ["tabs", "scripting", "activeTab", "storage"]`
  - `externally_connectable` for localhost and production domains
  - `background.service_worker` points to background.js
  - `content_scripts` for gemini.google.com

#### **chrome-extension/background.js**
- **Type:** Service Worker (Manifest V3)
- **Purpose:** Message relay between GenPuzzle and content scripts
- **Responsibilities:**
  - Listen for external messages from GenPuzzle via `onMessageExternal`
  - Validate message format (must include `prompt` field)
  - Map provider string to URL (gemini → gemini.google.com/app)
  - Open new tab to AI provider
  - Store request metadata keyed by tabId
  - Listen for responses from content script via `onMessage`
  - Format and relay responses back to GenPuzzle tab
  - Auto-cleanup: Remove request after 10 min or tab close

#### **chrome-extension/content.js**
- **Type:** Content Script
- **Purpose:** Automate AI provider UI and extract generated content
- **Responsibilities:**
  - Receive prompt injection from background via `onMessage`
  - Route to correct AI provider automation:
    - `injectPromptGemini()` for Gemini
    - `injectPromptFlux()` for Flux (future)
  - Find and populate prompt input elements
  - Trigger submit/generate buttons
  - Implement `MutationObserver` to wait for response
  - Extract text content or images
  - Clean markdown formatting
  - Parse structured data (Theme + words)
  - Send data back to background script

---

### 2. GenPuzzle Integration Files

#### **src/lib/genpuzzle-extension-integration.ts**
- **Type:** TypeScript Integration Layer
- **Purpose:** React hooks and utilities for word generation
- **Exports:**
  - `EXTENSION_ID` (configuration constant)
  - `generateWords(options)` → sends request to extension
  - `generateImage(prompt, provider)` → sends image request
  - `onWordsGenerated(callback)` → listener for word responses
  - `onImageGenerated(callback)` → listener for image responses
  - `useWordGeneration()` → React hook: {generateWords, isLoading, data, error}
  - `useImageGeneration()` → React hook for images
- **Key Features:**
  - Constructs dynamic prompt from options
  - Handles Chrome API guards (checks if chrome is available)
  - Validates extension ID
  - Tracks requests via requestId
  - Updates component state on response
  - Error handling with user-friendly messages

#### **src/components/WordSearchSidebar.tsx**
- **Type:** React Component (Updated)
- **Purpose:** Main UI for word search configuration
- **Changes Made:**
  - Added import: `import { useWordGeneration } from '@/lib/genpuzzle-extension-integration';`
  - Added hook init in component function
  - Added `useEffect` to handle response data
  - Added `handleGenerateWordsFromAI()` function
  - Added "Generate Words with AI" button in AI section
  - Added loading state display
  - Added error message display
  - Added success feedback
- **Integration Points:**
  - Line ~420: Hook initialization
  - Line ~423-431: useEffect for response handling
  - Line ~475-495: Handler function
  - Line ~1110-1150: Generate button UI

---

### 3. Documentation Files

#### **CHROME_EXTENSION_COMPLETE_GUIDE.md**
- **Type:** Technical Documentation
- **Contains:**
  - Complete architecture overview
  - File structure
  - Message format specification
  - Setup instructions (4 steps)
  - Complete file contents
  - GenPuzzle component integration guide
  - Data flow walkthrough (9 steps)
  - Troubleshooting guide
  - Production deployment checklist
  - Environment variables
  - Next steps & future features

#### **CHROME_EXTENSION_QUICK_REFERENCE.md**
- **Type:** Reference Guide
- **Contains:**
  - Current setup summary
  - Message format specification
  - Data flow diagram (ASCII art)
  - Error messages & solutions
  - Testing checklist
  - Implementation checklist
  - Performance metrics
  - Browser compatibility
  - Security considerations
  - Support resources

#### **CHROME_EXTENSION_PRODUCTION_READY.md**
- **Type:** Implementation Summary (This file)
- **Contains:**
  - Complete implementation overview
  - Current configuration status
  - Complete data flow explanation
  - Message specifications
  - File descriptions
  - Testing instructions (step-by-step)
  - Troubleshooting guide
  - Code examples
  - Performance metrics
  - Browser support matrix
  - Security checklist
  - Deployment checklist
  - Next features

---

## Message Flow

### Request (GenPuzzle → Extension)
```javascript
{
  action: "GENERATE_WORDS",              // Identifies operation
  provider: "gemini",                    // Maps to provider URL
  prompt: "Generate 1 word lists...",    // Full prompt text
  requestId: "gen_1717945627842_abc123"  // Unique tracking ID
}
```
**Sent via:** `chrome.runtime.sendMessage(EXTENSION_ID, message)`
**Received by:** `background.js onMessageExternal`

### Response (Extension → GenPuzzle)
```javascript
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_WORDS",
  dataType: "text",
  requestId: "gen_1717945627842_abc123",
  words: [
    {theme: "Animals", words: ["lion", "tiger", "bear"]},
    {theme: "Fruits", words: ["apple", "banana"]}
  ],
  success: true,
  timestamp: 1717945700000
}
```
**Sent via:** `chrome.tabs.sendMessage(genPuzzleTabId, response)`
**Received by:** `useWordGeneration hook onWordsGenerated listener`

---

## Key Features

### ✅ Production Ready
- [x] Manifest V3 compliant
- [x] Error handling with guards
- [x] Request tracking via requestId
- [x] Auto-cleanup timeout (10 min)
- [x] Message validation
- [x] React hook pattern
- [x] TypeScript types

### ✅ User Experience
- [x] Loading state display
- [x] Error messages to user
- [x] Success feedback
- [x] Auto-tab opening
- [x] Auto-word extraction
- [x] Auto-population of word list

### ✅ Security
- [x] Extension ID validation
- [x] Domain restrictions (externally_connectable)
- [x] Content scope limited
- [x] Request timeouts
- [x] No credential storage

### ✅ Debugging
- [x] Console logging throughout
- [x] Error messages with context
- [x] Request metadata tracking
- [x] DevTools inspection support

---

## Configuration Points

### 1. Extension ID (REQUIRED)
**File:** `src/lib/genpuzzle-extension-integration.ts` (Line 18)
```typescript
export const EXTENSION_ID = "pkokhbpdkolfhcbbghmopfcfbiamioie";
```
**How to Get:**
1. `chrome://extensions/`
2. Enable "Developer mode"
3. Find extension, copy ID

### 2. Provider URLs (Optional)
**File:** `chrome-extension/background.js` (Line 40-45)
**Current:** Maps provider to URL
```javascript
const providerUrls = {
  gemini: "https://gemini.google.com/app",
  flux: "https://flux-1-fill.replicate.com/",
  replicate: "https://replicate.com/",
};
```

### 3. Content Selectors (May Need Updates)
**File:** `chrome-extension/content.js` (Lines 40-50, 70-80)
**Issue:** If Gemini UI changes, selectors need updating
**Solution:** Inspect element on gemini.google.com, update selectors

### 4. Domain Matching (Production)
**File:** `chrome-extension/manifest.json` (externally_connectable)
**Update For Production:**
```json
"externally_connectable": {
  "matches": [
    "https://puzzlertool.com/*",
    "https://www.puzzlertool.com/*"
  ]
}
```

---

## Testing Verification

### ✅ Extension Installed
- `chrome://extensions/` shows GenPuzzle Extension
- Extension is enabled (toggle ON)
- Extension ID visible and copied

### ✅ GenPuzzle Running
- `http://localhost:3000` loads without errors
- Word Search section visible
- Words tab accessible

### ✅ Generate Button Visible
- AI Word Generation section visible
- "Generate Words with AI" button visible
- Button is clickable

### ✅ Function Works
- Click button → Gemini tab opens
- Prompt appears in Gemini
- Gemini generates response
- Words extracted and cleaned
- Textarea updates with words
- Success message displays

---

## Performance Expectations

| Step | Time |
|------|------|
| Message delivery | 5-10ms |
| Tab creation | 100-200ms |
| Content injection | 50-100ms |
| Gemini UI interaction | 500-1000ms |
| AI generation | 5-30 seconds |
| Response extraction | 100-200ms |
| DOM update | 50-100ms |
| **Total** | **~5-40 seconds** |

---

## Troubleshooting Quick Map

| Error | Check | Fix |
|-------|-------|-----|
| "ID not configured" | Extension ID in integration file | Update EXTENSION_ID |
| "Missing prompt or aiUrl" | Message format | Verify prompt field included |
| "API not available" | Extension installed/enabled | Load/enable in chrome://extensions/ |
| Tab opens but no generation | Gemini selectors | Inspect & update content.js |
| Words not in textarea | Hook initialization | Verify useEffect dependencies |
| No response back | Background listener | Check console for errors |

---

## Next Steps

1. **Immediate:** Test word generation with multiple themes
2. **Week 1:** Add Flux image generation support
3. **Week 2:** Implement provider settings UI
4. **Week 3:** Add caching for repeated themes
5. **Week 4:** Production deployment

---

## Files Included in This Release

| File | Type | Status |
|------|------|--------|
| chrome-extension/manifest.json | Config | ✅ Complete |
| chrome-extension/background.js | Script | ✅ Complete |
| chrome-extension/content.js | Script | ✅ Complete |
| src/lib/genpuzzle-extension-integration.ts | TypeScript | ✅ Complete |
| src/components/WordSearchSidebar.tsx | Component | ✅ Updated |
| CHROME_EXTENSION_COMPLETE_GUIDE.md | Doc | ✅ Complete |
| CHROME_EXTENSION_QUICK_REFERENCE.md | Doc | ✅ Complete |
| CHROME_EXTENSION_PRODUCTION_READY.md | Doc | ✅ Complete |

---

## Version

**Version:** 1.0.0 (Production Ready)  
**Date:** 2025-06-08  
**Status:** ✅ Ready for Testing & Deployment

---

## Support

- 📖 Full guide: `CHROME_EXTENSION_COMPLETE_GUIDE.md`
- 🚀 Quick start: `CHROME_EXTENSION_QUICK_REFERENCE.md`
- 🔧 Troubleshooting: See "Troubleshooting" section in any guide
- 💬 Console: Check browser DevTools (F12) for logs
- 🐛 Issues: Review error messages in quick reference table

**Ready to deploy! 🎉**
