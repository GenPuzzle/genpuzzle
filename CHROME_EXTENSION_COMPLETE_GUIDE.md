# Complete Chrome Extension Integration Guide (Manifest V3)

## Overview

This guide provides the complete production-ready Chrome Extension (Manifest V3) for automating word generation from AI providers directly integrated into GenPuzzle.

### Architecture

```
GenPuzzle Website (localhost:3000)
        ↓
   [Generate Words Button]
        ↓
chrome.runtime.sendMessage() to Extension
        ↓
Extension Background Service Worker (background.js)
        ↓
Opens Gemini tab & injects prompt via Content Script
        ↓
Content Script (content.js) - Automates Gemini UI
        ↓
Waits for response, extracts & cleans text
        ↓
Sends structured data back to GenPuzzle
        ↓
GenPuzzle updates word list automatically
```

---

## File Structure

```
chrome-extension/
├── manifest.json          ← Extension configuration
├── background.js          ← Service worker (message relay)
├── content.js             ← Gemini automation & text extraction
└── (in GenPuzzle project)
    └── src/lib/
        └── genpuzzle-extension-integration.ts  ← React hooks & API
```

---

## 1. Message Format Specification

### GenPuzzle → Extension (via chrome.runtime.sendMessage)

**Format:**
```typescript
{
  action: "GENERATE_WORDS",           // Required: identifies operation type
  provider: "gemini",                 // Required: "gemini", "flux", or "replicate"
  prompt: string,                     // Required: the actual prompt to send to AI
  requestId?: string                  // Optional: unique ID for tracking (auto-generated if omitted)
}
```

**Example:**
```typescript
{
  action: "GENERATE_WORDS",
  provider: "gemini",
  prompt: "Generate 1 word lists. Each word must not exceed 15 letters in uppercase case. Unique no duplicated words, target audience: Children 9-12, language: English. Make sure to add space between words when we have 2 words based. Format:\nAnimals\nword, word, word...",
  requestId: "gen_1717945627842_abc123"
}
```

### Extension → GenPuzzle (via chrome.runtime.onMessage)

**Format:**
```typescript
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_WORDS",
  dataType: "text",
  requestId: string,
  words: Array<{
    theme: string;        // e.g., "Animals"
    words: string[]       // e.g., ["lion", "tiger", "bear"]
  }>,
  success: boolean,
  timestamp: number
}
```

**Example:**
```typescript
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_WORDS",
  dataType: "text",
  requestId: "gen_1717945627842_abc123",
  words: [
    {
      theme: "Animals",
      words: ["elephant", "giraffe", "zebra", "monkey"]
    }
  ],
  success: true,
  timestamp: 1717945700000
}
```

---

## 2. Setup Instructions

### Step 1: Get Your Extension ID

1. Go to `chrome://extensions/` in your browser
2. Enable "Developer mode" (toggle in top right)
3. Find your extension in the list
4. Copy the ID (32-character alphanumeric string)

### Step 2: Update Extension ID in GenPuzzle

Edit `src/lib/genpuzzle-extension-integration.ts`:

```typescript
export const EXTENSION_ID = "YOUR_ACTUAL_EXTENSION_ID_HERE";
// Replace with your actual ID from chrome://extensions/
```

### Step 3: Load Extension in Chrome

1. Go to `chrome://extensions/`
2. Click "Load unpacked"
3. Select the `chrome-extension/` folder from this project
4. Note the extension ID shown

### Step 4: Test the Integration

1. Run GenPuzzle: `pnpm dev` (usually on `http://localhost:3000`)
2. Navigate to "Word Search" → "Words" tab
3. Select "Use AI to Generate"
4. Enter a theme: e.g., "Animals, Fruits, Colors"
5. Click "Generate Words with AI"
6. A Gemini tab will open automatically
7. Words will be generated and populated in your list

---

## 3. Complete File Contents

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "GenPuzzle Word Generator",
  "version": "1.0.0",
  "description": "Automate word generation for GenPuzzle using AI providers",
  
  "permissions": [
    "tabs",
    "scripting",
    "activeTab",
    "storage"
  ],
  
  "host_permissions": [
    "https://gemini.google.com/*",
    "https://www.gemini.google.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": [
        "https://gemini.google.com/*",
        "https://www.gemini.google.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  
  "externally_connectable": {
    "matches": [
      "http://localhost/*",
      "http://127.0.0.1/*",
      "https://puzzlertool.com/*",
      "https://www.puzzlertool.com/*"
    ]
  },
  
  "action": {
    "default_title": "GenPuzzle Word Generator"
  }
}
```

### background.js
See the existing `chrome-extension/background.js` - it handles:
- Receiving external messages from GenPuzzle
- Opening Gemini tab with the prompt
- Relaying responses back to GenPuzzle
- Auto-cleanup after 10 minutes

### content.js
See the existing `chrome-extension/content.js` - it handles:
- Automating Gemini UI (finding textarea, injecting prompt)
- Waiting for response using MutationObserver
- Extracting and cleaning text content
- Parsing structured data (Theme + word list)
- Sending cleaned data back to background script

### src/lib/genpuzzle-extension-integration.ts

This file exports React hooks and utilities for GenPuzzle components:

```typescript
export const EXTENSION_ID = "pkokhbpdkolfhcbbghmopfcfbiamioie"; // Your actual ID

// Main function to send word generation request
export function generateWords(options: {
  puzzlesCount: number;
  maxLength: number;
  charCase: "uppercase" | "lowercase" | "mixed";
  ageLevel: string;
  language: string;
  themeTitle: string;
}): Promise<ExtensionResponse>

// React hook for word generation in components
export function useWordGeneration()
  → { generateWords, isLoading, data, error }

// Listener for responses
export function onWordsGenerated(callback: (data: WordsResponse) => void)
  → () => void (cleanup function)
```

---

## 4. GenPuzzle Component Integration

### In WordSearchSidebar.tsx

```typescript
import { useWordGeneration } from '@/lib/genpuzzle-extension-integration';

export function WordSearchSidebar() {
  // Initialize the word generation hook
  const { 
    generateWords: generateWordsFromExtension, 
    isLoading: isGeneratingWords, 
    data: generatedWordsData, 
    error: generationError 
  } = useWordGeneration();

  // Handle word generation response
  React.useEffect(() => {
    if (generatedWordsData && generatedWordsData.words) {
      const allWords: string[] = [];
      generatedWordsData.words.forEach((item: any) => {
        if (item.words && Array.isArray(item.words)) {
          allWords.push(...item.words);
        }
      });
      
      if (allWords.length > 0) {
        setTitleWords({ ...titleWords, words: allWords });
      }
    }
  }, [generatedWordsData]);

  // Handler for button click
  const handleGenerateWordsFromAI = async () => {
    if (!wordList.aiTheme.trim()) {
      alert('Please enter a theme for word generation');
      return;
    }

    const charCase = wordList.wordListCase === 'upper' ? 'uppercase' : 
                     wordList.wordListCase === 'lower' ? 'lowercase' : 'mixed';

    try {
      await generateWordsFromExtension({
        puzzlesCount: 1,
        maxLength: wordList.aiMaxWordLength,
        charCase,
        ageLevel: wordList.aiAgeLevel,
        language: wordList.aiLanguage,
        themeTitle: wordList.aiTheme,
      });
    } catch (err) {
      console.error('Failed to generate words:', err);
    }
  };

  return (
    // ... component JSX ...
    <Button onClick={handleGenerateWordsFromAI} disabled={isGeneratingWords}>
      <Zap className="w-4 h-4 mr-2" />
      {isGeneratingWords ? 'Generating Words...' : 'Generate Words with AI'}
    </Button>
    {generationError && (
      <div className="text-red-500 text-sm">{generationError}</div>
    )}
    // ...
  );
}
```

---

## 5. Data Flow Walkthrough

### Step 1: User Initiates Generation
```
User clicks "Generate Words with AI" button
↓
WordSearchSidebar calls: generateWordsFromExtension({
  puzzlesCount: 1,
  maxLength: 15,
  charCase: "uppercase",
  ageLevel: "Children 9-12",
  language: "English",
  themeTitle: "Animals, Fruits"
})
```

### Step 2: Message Sent to Extension
```
genpuzzle-extension-integration.ts constructs:
{
  action: "GENERATE_WORDS",
  provider: "gemini",
  prompt: "Generate 1 word lists. Each word must not exceed 15 letters in uppercase case...",
  requestId: "gen_1717945627842_abc123"
}
↓
chrome.runtime.sendMessage(EXTENSION_ID, message)
```

### Step 3: Background Service Worker Receives Message
```
background.js onMessageExternal listener:
- Validates prompt and provider
- Maps provider to Gemini URL
- Opens new Gemini tab
- Stores request metadata keyed by tabId
- Returns { success: true, tabId, requestId }
```

### Step 4: Tab Loads & Content Script Runs
```
background.js onUpdated listener:
- Detects Gemini tab fully loaded
- Injects prompt via: chrome.tabs.sendMessage(tabId, {
    type: "INJECT_PROMPT",
    action: "GENERATE_WORDS",
    prompt: "...",
    provider: "gemini"
  })
```

### Step 5: Content Script Automates Gemini
```
content.js injectPromptGemini():
- Finds textarea with "Ask" placeholder
- Sets textarea.value = prompt
- Triggers input/change events
- Finds and clicks submit button
- Starts MutationObserver to wait for response
```

### Step 6: Text Extraction & Parsing
```
content.js waitForResponse() → extractAndCleanTextContent():
- Removes all markdown formatting
- Splits into lines
- Identifies Theme Titles (short, capitalized lines)
- Identifies Word Lists (comma-separated items)
- Parses into: [{theme: "Animals", words: ["lion", "tiger"]}, ...]
```

### Step 7: Response Sent Back
```
content.js sendTextBack():
- chrome.runtime.sendMessage(background, {
    type: "RESPONSE_GENERATED",
    dataType: "text",
    textData: [{theme: "Animals", words: ["lion", "tiger"]}]
  })
```

### Step 8: Background Relays to GenPuzzle
```
background.js onMessage listener:
- Formats data as: {
    type: "RESPONSE_RECEIVED",
    action: "GENERATE_WORDS",
    requestId: "gen_1717945627842_abc123",
    words: [...],
    success: true
  }
- Sends back to GenPuzzle tab via: chrome.tabs.sendMessage(senderTab.id, data)
```

### Step 9: GenPuzzle Updates UI
```
useWordGeneration hook:
- Listener receives response matching requestId
- Calls onWordsGenerated callback
- Updates data state
- WordSearchSidebar useEffect extracts words
- Updates titleWords with new word list
- UI shows success message
```

---

## 6. Troubleshooting

### Error: "Missing prompt or aiUrl"
- ✅ Solution: Ensure extension ID is correctly set in `genpuzzle-extension-integration.ts`
- ✅ Solution: Message must include `prompt` field
- ✅ Solution: Reload extension after code changes

### Error: "Chrome extension API not available"
- ✅ Extension is not installed, or
- ✅ Extension ID is incorrect, or
- ✅ Extension is disabled in `chrome://extensions/`

### Gemini tab opens but words not generated
- ✅ Check if Gemini textarea is being found (inspect element for correct selectors)
- ✅ Verify prompt format is correct
- ✅ Check DevTools Console in Gemini tab for content script errors
- ✅ Gemini UI might have changed - update selectors in content.js

### Words not appearing in GenPuzzle textarea
- ✅ Check browser Console for errors in GenPuzzle tab
- ✅ Verify useWordGeneration hook is properly initialized
- ✅ Check if response message format matches expected structure
- ✅ Verify requestId matches between request and response

---

## 7. Production Deployment

### Before Deploying:

1. **Update externally_connectable in manifest.json** to your production domain
2. **Change EXTENSION_ID** to your production extension ID
3. **Test thoroughly** with various themes and languages
4. **Add error recovery** for network timeouts
5. **Monitor** DevTools Console for errors

### Manifest.json for Production:
```json
"externally_connectable": {
  "matches": [
    "https://puzzlertool.com/*",
    "https://www.puzzlertool.com/*",
    "https://app.puzzlertool.com/*"
  ]
}
```

---

## 8. Current Status

✅ **Completed:**
- manifest.json configured for Gemini
- background.js fully functional
- content.js with text extraction & parsing
- genpuzzle-extension-integration.ts with React hooks
- WordSearchSidebar.tsx wired with Generate button
- Error handling and guards for missing chrome API
- Chrome extension ID configured

🚀 **Ready to Test:**
1. Extension is installed in Chrome
2. Extension ID is set correctly
3. Generate Words button is visible in WordSearchSidebar
4. Click to test the full automation flow

---

## 9. Environment Variables

No env vars required, but ensure:
- `EXTENSION_ID` is set in `src/lib/genpuzzle-extension-integration.ts`
- GenPuzzle runs on `localhost:3000` or configured domain
- Extension matches domain in `externally_connectable`

---

## Support & Next Steps

For issues:
1. Check Chrome DevTools Console (Ctrl+Shift+I)
2. Check extension background service worker logs
3. Review Gemini tab content script errors
4. Verify message format in Network tab

Next steps:
- [ ] Add support for more AI providers (Flux, Replicate)
- [ ] Implement image generation via Flux
- [ ] Add caching for repeated themes
- [ ] Build UI for extension settings
- [ ] Add analytics/logging
