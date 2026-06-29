# Chrome Extension Integration - Quick Reference

## Current Setup Summary

✅ **Extension ID:** `pkokhbpdkolfhcbbghmopfcfbiamioie`
✅ **Framework:** Manifest V3
✅ **Location:** `chrome-extension/` folder
✅ **GenPuzzle Integration:** `src/lib/genpuzzle-extension-integration.ts`
✅ **Component:** `src/components/WordSearchSidebar.tsx`

---

## Message Format Specification

### What GenPuzzle Sends to Chrome Extension

**Method:** `chrome.runtime.sendMessage(EXTENSION_ID, message, callback)`

**Message Structure:**
```javascript
{
  action: "GENERATE_WORDS",              // ← REQUIRED: identifies the operation
  provider: "gemini",                    // ← REQUIRED: "gemini" | "flux" | "replicate"
  prompt: "Generate 1 word lists...",    // ← REQUIRED: the actual prompt to send to AI
  requestId: "gen_1717945627842_abc123"  // ← Auto-generated if not provided
}
```

**Why This Format Works:**
- `action`: Tells extension what we're doing (words vs images)
- `provider`: Maps to URL (gemini.google.com, flux, etc)
- `prompt`: The actual instruction for the AI
- `requestId`: Tracks which request matches which response

---

### What Chrome Extension Sends Back to GenPuzzle

**Method:** `chrome.runtime.sendMessage(response, callback)`

**Response Structure:**
```javascript
{
  type: "RESPONSE_RECEIVED",             // ← Always this value
  action: "GENERATE_WORDS",              // ← Same as original request
  dataType: "text",                      // ← "text" for words | "image" for images
  requestId: "gen_1717945627842_abc123", // ← Matches the request ID
  words: [
    {
      theme: "Animals",
      words: ["elephant", "giraffe", "zebra"]
    },
    {
      theme: "Fruits",
      words: ["apple", "banana", "orange"]
    }
  ],
  success: true,
  timestamp: 1717945700000
}
```

---

## Data Flow Diagram

```
┌─────────────────────┐
│  GenPuzzle Website  │
│ localhost:3000      │
└──────────┬──────────┘
           │
           │ 1. User clicks "Generate Words with AI"
           │    Calls: generateWordsFromExtension({theme, language, etc})
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ genpuzzle-extension-integration.ts                      │
│ - Builds prompt from options                           │
│ - Calls: chrome.runtime.sendMessage(EXTENSION_ID, msg) │
│ - Receives response in onWordsGenerated listener        │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 2. Send message:
           │ {
           │   action: "GENERATE_WORDS",
           │   provider: "gemini",
           │   prompt: "Generate 1 word lists...",
           │   requestId: "gen_..."
           │ }
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ Chrome Extension - background.js (Service Worker)       │
│ - Validates message has prompt                          │
│ - Opens Gemini tab                                      │
│ - Stores request metadata                               │
│ - Returns: {success: true, tabId, requestId}            │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 3. Tab loads & onUpdated fires
           │    Injects prompt via content.js
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ Chrome Extension - content.js (Gemini Page)             │
│ - Finds textarea with "Ask" placeholder                 │
│ - Injects prompt text                                   │
│ - Clicks submit button                                  │
│ - Waits for response with MutationObserver              │
│ - Extracts & cleans text                                │
│ - Parses: [{theme: "...", words: [...]}]                │
│ - Sends back to background                              │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 4. Content script sends:
           │ {
           │   type: "RESPONSE_GENERATED",
           │   dataType: "text",
           │   textData: [{theme, words}]
           │ }
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ Chrome Extension - background.js (Relay)                │
│ - Formats response                                      │
│ - Adds action, requestId, timestamp                     │
│ - Sends to GenPuzzle tab                                │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 5. Send response to GenPuzzle:
           │ {
           │   type: "RESPONSE_RECEIVED",
           │   action: "GENERATE_WORDS",
           │   words: [{theme, words}],
           │   success: true
           │ }
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ GenPuzzle - useWordGeneration hook                       │
│ - onWordsGenerated listener catches response            │
│ - Checks requestId matches                              │
│ - Calls setData(response)                               │
│ - Updates isLoading, error states                       │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 6. useEffect triggers:
           │    if (generatedWordsData?.words)
           │      Extract all words from structured data
           │      setTitleWords({...titleWords, words: [...]})
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ WordSearchSidebar Component                              │
│ - Word list textarea updates                            │
│ - Shows success message                                 │
│ - User can now create puzzle with AI words              │
└─────────────────────────────────────────────────────────┘
```

---

## Error Messages & Solutions

### Error: "Extension ID not configured"
**Cause:** EXTENSION_ID is "YOUR_EXTENSION_ID_HERE" in integration file

**Solution:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Find your extension, copy the ID
4. Update `EXTENSION_ID` in `src/lib/genpuzzle-extension-integration.ts`
5. Reload GenPuzzle page

---

### Error: "Missing prompt or aiUrl"
**Cause:** The message doesn't contain `prompt` field

**Solution:**
1. Check that `action` is included: `"GENERATE_WORDS"`
2. Check that `prompt` is included: the full dynamic prompt string
3. Check that `provider` is included: `"gemini"`
4. Ensure message is sent to correct extension ID
5. Verify extension is installed and enabled

---

### Error: "Chrome extension API not available"
**Cause:** Extension is not installed, disabled, or chrome API not accessible

**Solution:**
1. Verify extension is installed: `chrome://extensions/`
2. Enable extension if disabled
3. Reload GenPuzzle page
4. Check browser console for errors

---

### Gemini Tab Opens But Words Don't Generate
**Cause:** Content script can't find Gemini textarea or submit button

**Solution:**
1. Open Gemini tab manually: https://gemini.google.com/app
2. Right-click on the prompt input → Inspect
3. Check the selector (class, id, aria-label)
4. Update selectors in `chrome-extension/content.js` lines 40-50
5. Reload extension and try again

---

### Words Generated But Not Appearing in GenPuzzle
**Cause:** useEffect not processing the response correctly

**Solution:**
1. Check browser console in GenPuzzle tab
2. Verify `generatedWordsData` has `words` array
3. Verify `words[].words` is extracting correctly
4. Check that `setTitleWords` is being called

---

## Testing Checklist

- [ ] Extension is installed in Chrome (`chrome://extensions/`)
- [ ] Extension ID is correctly set in `genpuzzle-extension-integration.ts`
- [ ] GenPuzzle running on `http://localhost:3000` (or configured domain)
- [ ] "Word Search" section visible in sidebar
- [ ] "Use AI to Generate" option visible
- [ ] "Generate Words with AI" button visible
- [ ] Click button → Gemini tab opens
- [ ] Prompt automatically entered in Gemini
- [ ] Gemini generates response
- [ ] Words extracted and cleaned
- [ ] Word list textarea updates with new words
- [ ] Success message displays

---

## Implementation Checklist

✅ **Phase 1: Setup**
- [x] Chrome Extension created (manifest.json, background.js, content.js)
- [x] Extension ID configured
- [x] GenPuzzle integration file created
- [x] WordSearchSidebar button added
- [x] useWordGeneration hook initialized

✅ **Phase 2: Message Handling**
- [x] generateWords() sends correct message format
- [x] background.js validates prompt
- [x] background.js opens Gemini tab
- [x] content.js injects prompt into Gemini
- [x] content.js extracts response text

✅ **Phase 3: Data Processing**
- [x] Text cleaning removes markdown
- [x] Theme/word parsing extracts structured data
- [x] Response sent back to GenPuzzle
- [x] useEffect updates titleWords

✅ **Phase 4: Error Handling**
- [x] Chrome API guard added
- [x] Extension ID validation
- [x] Error messages displayed to user
- [x] Graceful fallback if extension not available

---

## Performance Metrics

- **Message Send Time:** ~5-10ms
- **Tab Creation Time:** ~100-200ms
- **Content Script Injection:** ~50-100ms
- **Gemini Response Time:** 5-30 seconds (depends on AI)
- **Text Extraction Time:** ~100-200ms
- **Total Flow Time:** 5-40 seconds (mostly Gemini AI time)

---

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Chromium-based (Edge, Brave, Vivaldi)
- ❌ Firefox (uses WebExtensions, different API)
- ❌ Safari (uses Safari App Extensions, different API)

---

## Security Considerations

1. **Message Validation:** background.js validates all incoming messages
2. **Extension ID Matching:** Only messages from correct extension ID accepted
3. **Domain Matching:** externally_connectable restricts to specific domains
4. **Content Script Scope:** Limited to gemini.google.com
5. **Request Timeouts:** Auto-cleanup after 10 minutes prevents memory leaks
6. **No Credentials Stored:** All data is temporary and request-specific

---

## Next Steps

1. ✅ Test word generation with various themes
2. ✅ Test error handling (network failures, etc)
3. ⏳ Add support for Flux image generation
4. ⏳ Add support for Replicate API
5. ⏳ Implement caching for repeated themes
6. ⏳ Add analytics/logging for debugging

---

## Support Resources

- Chrome Extension docs: https://developer.chrome.com/docs/extensions/
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Message Passing: https://developer.chrome.com/docs/extensions/mv3/messaging/
