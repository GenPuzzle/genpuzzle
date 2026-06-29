# Chrome Extension Integration Quick Start

Complete guide to integrate the GenPuzzle Chrome Extension with your web application.

## 📋 Prerequisites

- Chrome browser with the GenPuzzle extension installed
- Your extension ID (from `chrome://extensions/`)
- Next.js/React project (TypeScript recommended)

## 🚀 Quick Setup (5 minutes)

### Step 1: Install the Extension

1. Open `chrome://extensions/`
2. Click "Load unpacked"
3. Select the `chrome-extension/` folder from this project
4. **Copy your Extension ID** (shown under "GenPuzzle Image Generator")

### Step 2: Copy Integration File

Copy `genpuzzle-integration.ts` to your project:

```bash
cp chrome-extension/genpuzzle-integration.ts src/lib/genpuzzle-integration.ts
```

### Step 3: Update Extension ID

Edit `src/lib/genpuzzle-integration.ts` and replace:

```typescript
export const EXTENSION_ID = "YOUR_EXTENSION_ID_HERE";
```

with your actual extension ID from `chrome://extensions/`.

### Step 4: Use in Your Component

```typescript
import { useWordGeneration } from '@/lib/genpuzzle-integration';

export function MyComponent() {
  const { generateWords, isLoading, data, error } = useWordGeneration();

  return (
    <button 
      onClick={() => generateWords({
        puzzlesCount: 5,
        maxLength: 8,
        charCase: "lowercase",
        ageLevel: "8-10",
        language: "English",
        themeTitle: "Animals"
      })}
      disabled={isLoading}
    >
      {isLoading ? "Generating..." : "Generate Words"}
    </button>
  );
}
```

## 📚 API Reference

### Functions

#### `generateWords(options)`
Send word generation request to extension.

```typescript
const response = await generateWords({
  puzzlesCount: 5,
  maxLength: 8,
  charCase: "lowercase",
  ageLevel: "8-10",
  language: "English",
  themeTitle: "Animals\nFruits"
});

// Returns: { success: true, action: "GENERATE_WORDS", requestId: "..." }
```

#### `generateImage(prompt, provider?)`
Send image generation request to extension.

```typescript
const response = await generateImage(
  "A cute robot holding a puzzle",
  "gemini" // "gemini" | "flux" | "replicate"
);
```

#### `onWordsGenerated(callback)`
Listen for word generation responses.

```typescript
const cleanup = onWordsGenerated((data) => {
  console.log("Words:", data.words);
  // data.words = [{ theme: "Animals", words: ["lion", "tiger"] }]
});

// Call cleanup to remove listener
```

#### `onImageGenerated(callback)`
Listen for image generation responses.

```typescript
const cleanup = onImageGenerated((data) => {
  console.log("Image:", data.imageData); // base64 data URL
});
```

### React Hooks

#### `useWordGeneration()`

```typescript
const {
  generateWords,  // Function to call
  isLoading,      // Boolean
  data,           // WordsResponse | null
  error           // string | null
} = useWordGeneration();
```

#### `useImageGeneration()`

```typescript
const {
  generateImage,  // Function to call
  isLoading,      // Boolean
  imageData,      // base64 data URL | null
  error           // string | null
} = useImageGeneration();
```

## 🔧 Advanced Usage

### Manual Control (No Hooks)

```typescript
import { generateWords, onWordsGenerated } from '@/lib/genpuzzle-integration';

export function AdvancedComponent() {
  const [words, setWords] = React.useState(null);

  React.useEffect(() => {
    const cleanup = onWordsGenerated((data) => {
      setWords(data.words);
    });
    return cleanup;
  }, []);

  const handleClick = async () => {
    const response = await generateWords({
      puzzlesCount: 3,
      maxLength: 10,
      charCase: "lowercase",
      ageLevel: "6-8",
      language: "English",
      themeTitle: "Colors"
    });
    
    if (!response.success) {
      console.error(response.error);
    }
  };

  return (
    <>
      <button onClick={handleClick}>Generate</button>
      {words && <pre>{JSON.stringify(words, null, 2)}</pre>}
    </>
  );
}
```

### Direct Chrome API (Legacy)

```typescript
// If you prefer using chrome.runtime.sendMessage directly:

const extensionId = "YOUR_EXTENSION_ID";

chrome.runtime.sendMessage(extensionId, {
  action: "GENERATE_WORDS",
  provider: "gemini",
  prompt: "Your prompt here",
  requestId: "optional_request_id"
}, (response) => {
  if (response.success) {
    console.log("Started:", response.requestId);
  }
});

// Listen for response
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "RESPONSE_RECEIVED" && 
      message.action === "GENERATE_WORDS") {
    console.log("Words:", message.words);
  }
});
```

## 📊 Response Data Format

### Word Generation Response

```typescript
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_WORDS",
  requestId: "gen_1234567890_abc123",
  dataType: "text",
  words: [
    { 
      theme: "Animals", 
      words: ["elephant", "lion", "tiger", "zebra"] 
    },
    { 
      theme: "Colors", 
      words: ["red", "blue", "green"] 
    }
  ],
  success: true,
  timestamp: 1234567890
}
```

### Image Generation Response

```typescript
{
  type: "RESPONSE_RECEIVED",
  action: "GENERATE_IMAGE",
  requestId: "img_1234567890_abc123",
  dataType: "image",
  imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA...",
  timestamp: 1234567890
}
```

## ❌ Troubleshooting

### "Extension ID not set"
- Copy your extension ID from `chrome://extensions/`
- Update `EXTENSION_ID` in `genpuzzle-integration.ts`
- Make sure you're using the full ID string

### "Extension not installed or not accessible"
- Verify extension is installed: `chrome://extensions/`
- Check that extension is **enabled**
- Reload the extension after any code changes
- Make sure you're accessing from `localhost` (for dev)

### "Failed to generate words"
- Check browser console for errors: `F12` → Console
- Look for `[Content]` and `[Background]` log messages
- Try a simpler prompt first
- Check that Gemini/AI provider is working manually

### Words not parsing correctly
- Verify Gemini response format: `Theme Title` + `word, word, word`
- Check console logs to see what was extracted
- Try a more specific prompt

## 🔐 Security Notes

- Extension only runs on localhost for development
- Update `externally_connectable` in `manifest.json` for production domain
- No credentials or API keys are stored
- Each request has unique requestId for tracking

## 📦 Environment Variables (Optional)

Create `.env.local` for your extension ID:

```env
NEXT_PUBLIC_EXTENSION_ID=YOUR_EXTENSION_ID_HERE
```

Then update `genpuzzle-integration.ts`:

```typescript
export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "YOUR_EXTENSION_ID_HERE";
```

## 🐛 Debug Mode

Enable detailed logging by adding this to your component:

```typescript
// In your component or _app.tsx
if (typeof window !== 'undefined') {
  window.__DEBUG_EXTENSION = true;
}

// Then check console for detailed logs
```

## 📞 Support

For issues or questions:
1. Check the README.md in `chrome-extension/`
2. Review browser console logs (F12)
3. Check extension logs: `chrome://extensions/` → Service Worker
4. See debugging section above

## 🎯 Next Steps

1. ✅ Install extension and get ID
2. ✅ Copy integration file
3. ✅ Update extension ID
4. ✅ Test with `useWordGeneration()` hook
5. ✅ Integrate into your components
6. ✅ Handle responses and errors
7. ✅ Test with different prompts
8. ✅ Deploy extension to Chrome Web Store (for production)
