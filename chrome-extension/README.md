# GenPuzzle Image Generator & Text Scraper Chrome Extension

Automate AI image generation and text content extraction (with cleaning) for puzzle creation directly from GenPuzzle using free web interfaces.

## Architecture Overview

```
GenPuzzle Website (localhost:3000)
        ↓
   Send prompt via chrome.runtime.sendMessage()
        ↓
Background Service Worker (background.js)
        ↓
   Open AI provider tab (Gemini, Flux, etc.)
        ↓
Content Script (content.js)
        ↓
   Automate prompt injection and response extraction
   (Images OR cleaned text with Theme + Word List format)
        ↓
Background Service Worker
        ↓
   Relay response back to GenPuzzle via chrome.runtime.sendMessage()
        ↓
GenPuzzle Website
```

## Files

### `manifest.json`
- **Manifest Version**: 3 (latest Chrome Extension standard)
- **Permissions**: 
  - `tabs`: Manage tab creation
  - `activeTab`: Access active tab
  - `scripting`: Inject scripts into pages
  - `storage`: Store extension data
- **Externally Connectable**: Allows GenPuzzle website (localhost, puzzlertool.com) to send messages directly to the extension
- **Content Scripts**: Configured to run on Gemini, Flux, and Replicate domains
- **Icons**: Removed (uses Chrome default during development)

### `background.js` (Service Worker)
**Key Functions:**

1. **`chrome.runtime.onMessageExternal`** - Listen for external messages from GenPuzzle
   - Validates request contains `prompt` and `aiUrl`
   - Opens new tab to AI provider
   - Stores request metadata (prompt, requestId, sender info)

2. **`chrome.tabs.onUpdated`** - Wait for tab to fully load
   - Injects prompt via `INJECT_PROMPT` message to content script
   - Content script then automates the prompt entry and response collection

3. **`chrome.runtime.onMessage`** (from content script) - Receive generated content
   - Extracts imageData OR textData from content script
   - Relays `RESPONSE_RECEIVED` back to GenPuzzle website with appropriate dataType

4. **Cleanup** - Auto-cleanup of requests after 10 minutes or when tab closes

### `content.js` (Content Script)
**Key Functions:**

1. **Provider-Specific Automation**
   - `injectPromptGemini()` - Finds textarea, enters prompt, clicks send
   - `injectPromptFlux()` - Finds input field, enters prompt, clicks generate
   - Auto-detects AI provider based on hostname

2. **Response Detection & Extraction**
   - `waitForResponse()` - Uses MutationObserver to detect when response appears (image OR text)
   - Prioritizes image extraction first, falls back to text content
   - Handles multiple image formats: `<img>` tags, blob URLs, canvas elements

3. **Text Cleaning & Structured Parsing**
   - `extractAndCleanTextContent()` - Extracts and cleans AI responses
   - Strips ALL markdown: `**bold**`, `__bold__`, `*italic*`, `_italic_`, `~~strikethrough~~`, backticks, code blocks, headers, links
   - **Strictly isolates theme + word list format:**
     - Pattern: `Theme Title` (short, capitalized) followed by `word, word, word...` (comma-separated)
     - `isThemeTitle()` - Validates lines are short titles (not full sentences)
     - `isWordList()` - Validates lines are comma-separated word lists
     - `cleanWords()` - Removes common words (the, a, an, and, or, etc.) and normalizes to lowercase
   - Returns structured array: `[{ theme: "Title", words: ["word1", "word2"] }]`

4. **Image Extraction**
   - Handles blob URLs and data URLs
   - Fetches regular URLs and converts to base64
   - Extracts canvas elements as PNG data URLs

## Installation

1. **For Development:**
   ```bash
   # Open Chrome and go to:
   chrome://extensions/
   
   # Enable "Developer mode" (top right)
   # Click "Load unpacked"
   # Select this directory (/chrome-extension)
   ```

2. **For Production:**
   - Package as `.crx` file
   - Submit to Chrome Web Store
   - Update `externally_connectable` matches for production domain

## Usage from GenPuzzle

### Step 1: Get Your Extension ID

1. Install the extension from `chrome://extensions/`
2. Copy your extension ID (shown below the extension name)
3. Update `EXTENSION_ID` in `genpuzzle-integration.ts`

### Step 2: Import Integration Module

Place `genpuzzle-integration.ts` in your `src/lib/` directory and import it:

```typescript
import { useWordGeneration, useImageGeneration, generateWords, generateImage } from '@/lib/genpuzzle-integration';
```

### Step 3: Use the Hooks or Direct Functions

#### Method A: React Hooks (Recommended)

```typescript
// In your React component
import { useWordGeneration } from '@/lib/genpuzzle-integration';

export function WordGeneratorComponent() {
  const { generateWords, isLoading, data, error } = useWordGeneration();

  const handleGenerate = () => {
    generateWords({
      puzzlesCount: 5,
      maxLength: 8,
      charCase: "lowercase",
      ageLevel: "8-10",
      language: "English",
      themeTitle: "Animals\nFruits\nColors"
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate Words"}
      </button>
      
      {error && <div style={{color: 'red'}}>{error}</div>}
      
      {data && (
        <div>
          {data.words?.map((item, idx) => (
            <div key={idx}>
              <strong>{item.theme}</strong>: {item.words.join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Method B: Direct Functions with Listeners

```typescript
import { generateWords, onWordsGenerated } from '@/lib/genpuzzle-integration';

export function WordGeneratorComponent() {
  const [words, setWords] = React.useState(null);

  React.useEffect(() => {
    // Listen for word generation responses
    const cleanup = onWordsGenerated((data) => {
      setWords(data.words);
    });

    return cleanup;
  }, []);

  const handleGenerate = async () => {
    const response = await generateWords({
      puzzlesCount: 5,
      maxLength: 8,
      charCase: "lowercase",
      ageLevel: "8-10",
      language: "English",
      themeTitle: "Animals"
    });

    if (response.success) {
      console.log("Word generation started:", response);
    }
  };

  return (
    <>
      <button onClick={handleGenerate}>Generate Words</button>
      {words && <pre>{JSON.stringify(words, null, 2)}</pre>}
    </>
  );
}
```

#### Method C: Your Original Code Pattern

If you prefer the window messaging pattern from your original code:

```typescript
const extensionId = "YOUR_ACTUAL_EXTENSION_ID";

const handleGenerateWords = () => {
    const dynamicPrompt = `Generate ${puzzlesCount} word lists...`;

    chrome.runtime.sendMessage(extensionId, {
        action: "GENERATE_WORDS",
        provider: "gemini",
        prompt: dynamicPrompt
    }, (response) => {
        if (response && response.success) {
            console.log("Extension automation started.");
        }
    });
};

// Listen for response
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RESPONSE_RECEIVED" && 
        message.action === "GENERATE_WORDS") {
        const cleanedWords = message.words; 
        setYourWordsTextArea(cleanedWords); 
    }
});
```

### Message Format Reference

#### Request Format

```typescript
// For word generation
{
  action: "GENERATE_WORDS",
  provider: "gemini", // or "flux" or "replicate"
  prompt: "Your prompt here",
  requestId: "unique_id" // optional, auto-generated if not provided
}

// For image generation
{
  action: "GENERATE_IMAGE",
  provider: "gemini",
  prompt: "Your image prompt here",
  requestId: "unique_id"
}
```

#### Response Format

```typescript
// For word/text responses
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_WORDS",
  requestId: "unique_id",
  dataType: "text",
  words: [
    { theme: "Animals", words: ["elephant", "lion", "tiger"] },
    { theme: "Colors", words: ["red", "blue", "green"] }
  ],
  textData: [...], // same as words
  success: true,
  timestamp: 1234567890
}

// For image responses
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_IMAGE",
  requestId: "unique_id",
  dataType: "image",
  imageData: "data:image/png;base64,...", // base64 data URL
  timestamp: 1234567890
}
```

### Send Request from Frontend

```javascript
// From your React/Next.js component
function sendGenerationRequest(prompt, aiUrl) {
  chrome.runtime.sendMessage(
    {
      prompt: prompt,
      aiUrl: aiUrl, // e.g., "https://gemini.google.com/app"
      requestId: `req_${Date.now()}`, // Unique identifier
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Extension not installed or accessible");
      } else {
        console.log("Generation started:", response);
      }
    }
  );
}

// Usage for image generation
sendGenerationRequest(
  "A cute robot holding a puzzle piece",
  "https://gemini.google.com/app"
);

// Usage for text/word extraction
sendGenerationRequest(
  "Generate 5 puzzle themes with word lists. Format each as: Theme Title followed by: word, word, word, word",
  "https://gemini.google.com/app"
);
```

### Listen for Response

```javascript
// Listen for messages from extension
function listenForExtensionResponse() {
  if (typeof window !== 'undefined' && window.chrome?.runtime) {
    chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
      if (message.type === "RESPONSE_RECEIVED") {
        const { dataType, imageData, textData, requestId } = message;
        
        console.log("Response received:", message);
        console.log("Request ID:", requestId);
        
        if (dataType === "image") {
          // Use imageData (base64 data URL) in your app
          console.log("Image received:", imageData);
          handleGeneratedImage(imageData);
        } else if (dataType === "text") {
          // Use textData (cleaned and parsed)
          console.log("Text received:", textData);
          handleGeneratedText(textData);
        }
      }
    });
  }
}

listenForExtensionResponse();
```

## Configuration

### Update GenPuzzle Domain
Edit `manifest.json` `externally_connectable` to match your domain:

```json
"externally_connectable": {
  "matches": [
    "https://yourcompany.com/*",
    "https://app.yourcompany.com/*"
  ]
}
```

### Add Support for Additional AI Providers

1. Add provider URL to `content_scripts[0].matches` in `manifest.json`:
   ```json
   "matches": [
     "https://gemini.google.com/*",
     "https://your-new-ai-provider.com/*"
   ]
   ```

2. Add automation function in `content.js`:
   ```javascript
   else if (hostname.includes("new-provider")) {
     injectPromptNewProvider(prompt);
   }
   ```

3. Implement `injectPromptNewProvider()` following the Gemini/Flux pattern

## Debugging

### View Extension Logs
1. Go to `chrome://extensions/`
2. Find "GenPuzzle Image Generator"
3. Click "Service worker" to view background script console
4. For content script logs, open DevTools on the AI provider page (F12) and check console

### Common Issues

**Issue**: Extension doesn't receive message from GenPuzzle
- Check that GenPuzzle domain matches `externally_connectable` in manifest
- Verify extension is installed and enabled

**Issue**: Content script doesn't find prompt textarea
- Open DevTools on the AI provider page (F12)
- Check console for errors from content script
- Adjust selectors in `injectPromptGemini()`/`injectPromptFlux()` if UI changed

**Issue**: Image/text response not detected
- Check if response is in an `<img>` tag, `<canvas>` element, or text nodes
- For images: Verify image has sufficient size (>100x100px) to avoid UI elements
- For text: Check console logs to see if text was extracted but not parsed
- Adjust selector patterns in `waitForResponse()` if AI provider UI changed

**Issue**: Text parsing not working correctly
- Verify Gemini response follows the expected format: `Theme Title` + `word, word, word...`
- Check console for parsed data output: `[Content] Parsed structured data:`
- Ensure markdown symbols are completely removed before parsing

## Security Notes

- This extension operates in a sandboxed environment
- GenPuzzle domain is restricted via `externally_connectable`
- Response data is transmitted as base64 data URLs or text (in-process)
- No API keys or credentials are stored or transmitted
- Each request has a unique `requestId` for tracking

## Future Improvements

- [ ] Add retry logic for failed generation
- [ ] Support more AI providers (DALL-E, Midjourney, Stable Diffusion)
- [ ] Add image quality/format options
- [ ] Implement progress notifications
- [ ] Add request queuing for multiple simultaneous requests
- [ ] Cache generated content locally
- [ ] Add settings panel for provider configuration
- [ ] Improve text parsing for non-English responses
- [ ] Add support for custom text extraction patterns
