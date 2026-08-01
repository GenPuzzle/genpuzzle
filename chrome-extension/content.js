/**
 * GenPuzzle Image Generator & Text Scraper - Content Script
 * 
 * Responsibilities:
 * - Check for queued prompts on page load
 * - Receive prompt injection from background script
 * - Automate prompt input on AI provider page
 * - Extract image data OR scraped text content with cleanup
 * - Clean markdown and format text data properly
 * - Send extracted data back to background script
 */

// Global reference to loader overlay
let loaderOverlay = null;
let importCompleteTimeout = null;

function createLoaderOverlay() {
  try {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => {
        try { createLoaderOverlay(); } catch (e) { /* ignore */ }
      });
      return;
    }
    if (document.getElementById('genpuzzle-loader-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'genpuzzle-loader-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.pointerEvents = 'none';

    const style = document.createElement('style');
    style.textContent = `
      .genpuzzle-loader-wrapper{position:relative;display:flex;align-items:center;justify-content:center;height:120px;width:auto;margin:2rem;font-family:Poppins,sans-serif;font-size:1.6em;font-weight:600;user-select:none;color:#fff;transform:scale(1.5)}
      .genpuzzle-loader{position:absolute;top:0;left:0;height:100%;width:100%;z-index:1;background-color:transparent;mask:repeating-linear-gradient(90deg,transparent 0,transparent 6px,black 7px,black 8px)}
      .genpuzzle-loader::after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background-image:radial-gradient(circle at 50% 50%,#ff0 0%,transparent 50%),radial-gradient(circle at 45% 45%,#f00 0%,transparent 45%),radial-gradient(circle at 55% 55%,#0ff 0%,transparent 45%),radial-gradient(circle at 45% 55%,#0f0 0%,transparent 45%),radial-gradient(circle at 55% 45%,#00f 0%,transparent 45%);mask:radial-gradient(circle at 50% 50%,transparent 0%,transparent 10%,black 25%);animation:genpuzzle-transform-animation 2s infinite alternate,genpuzzle-opacity-animation 4s infinite;animation-timing-function:cubic-bezier(0.6,0.8,0.5,1)}
      @keyframes genpuzzle-transform-animation{0%{transform:translate(-55%)}100%{transform:translate(55%)}}
      @keyframes genpuzzle-opacity-animation{0%,100%{opacity:0}15%{opacity:1}65%{opacity:0}}
      .genpuzzle-loader-letter{display:inline-block;opacity:0;animation:genpuzzle-loader-letter-anim 4s infinite linear;z-index:2}
      .genpuzzle-loader-letter:nth-child(1){animation-delay:0.1s}.genpuzzle-loader-letter:nth-child(2){animation-delay:0.205s}.genpuzzle-loader-letter:nth-child(3){animation-delay:0.31s}.genpuzzle-loader-letter:nth-child(4){animation-delay:0.415s}.genpuzzle-loader-letter:nth-child(5){animation-delay:0.521s}.genpuzzle-loader-letter:nth-child(6){animation-delay:0.626s}.genpuzzle-loader-letter:nth-child(7){animation-delay:0.731s}.genpuzzle-loader-letter:nth-child(8){animation-delay:0.837s}.genpuzzle-loader-letter:nth-child(9){animation-delay:0.942s}.genpuzzle-loader-letter:nth-child(10){animation-delay:1.047s}
      @keyframes genpuzzle-loader-letter-anim{0%{opacity:0}5%{opacity:1;text-shadow:0 0 4px #fff;transform:scale(1.1) translateY(-2px)}20%{opacity:0.2}100%{opacity:0}}
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'genpuzzle-loader-wrapper';

    const loader = document.createElement('div');
    loader.className = 'genpuzzle-loader';

    const letters = document.createElement('div');
    const text = 'Importing.';
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'genpuzzle-loader-letter';
      span.textContent = ch;
      letters.appendChild(span);
    }

    wrapper.appendChild(loader);
    wrapper.appendChild(letters);
    overlay.appendChild(style);
    overlay.appendChild(wrapper);

    document.body.appendChild(overlay);
    loaderOverlay = overlay;
    console.log('[Content] ✅ Loader overlay created and injected (CSP-safe)');
  } catch (err) {
    console.warn('[Content] Loader overlay creation failed, continuing without loader:', err);
    loaderOverlay = null;
  }
  }

/**
 * Show the loader animation
 */
function showLoader() {
  if (!loaderOverlay) {
    createLoaderOverlay();
  }
  if (loaderOverlay) {
    loaderOverlay.style.display = 'flex';
    console.log("[Content] 🔄 Loader animation started");
  }

  if (importCompleteTimeout) {
    clearTimeout(importCompleteTimeout);
    importCompleteTimeout = null;
  }

  importCompleteTimeout = setTimeout(() => {
    console.warn('[Content] ⏳ IMPORT_COMPLETE not received within 3 minutes. Hiding loader to avoid stale overlay.');
    hideLoader();
  }, 180000);
}

/**
 * Hide the loader animation
 */
function hideLoader() {
  if (importCompleteTimeout) {
    clearTimeout(importCompleteTimeout);
    importCompleteTimeout = null;
  }
  if (loaderOverlay) {
    loaderOverlay.style.display = 'none';
    console.log("[Content] ✅ Loader animation stopped");
  }
}

// Wrap only the initialization in IIFE to enable guard flag return statement
(function initializeExtension() {
  // FIX #1: PREVENT DUPLICATE INJECTIONS - Global guard flags
  if (window.hasGenPuzzlePromptRun) {
    console.log("[Content] Aborting duplicate script execution.");
    return;
  }
  window.hasGenPuzzlePromptRun = true;

  if (window.hasGeminiExtensionRun) {
    console.log("[Content] Extension already initialized on this tab. Aborting duplicate run.");
    return;
  }
  window.hasGeminiExtensionRun = true;
  console.log("[Content] Guard flag set - this tab initialization is now protected against duplicates");

  // On page load, check for queued prompt stored in chrome.storage.local via the background service worker
  (function checkForQueuedPrompt(attempt = 0) {
    console.log('[Content] Page loaded at:', window.location.href);
    console.log('[Content] Checking for queued prompt... attempt', attempt + 1);
    chrome.runtime.sendMessage(
      { type: 'GET_QUEUED_PROMPT' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Content] Error getting queued prompt:', chrome.runtime.lastError);
          if (attempt < 40) {
            setTimeout(() => checkForQueuedPrompt(attempt + 1), 500);
          }
          return;
        }

        if (response && response.success && response.data) {
          console.log('[Content] ✅ Found queued prompt!');
          console.log('[Content] Prompt preview:', response.data.prompt.substring(0, 100) + '...');
          const { prompt, provider } = response.data;

          const hostname = window.location.hostname;
          console.log('[Content] Hostname detected:', hostname);
          if (hostname.includes('gemini.google.com')) {
            injectPromptGemini(prompt);
          } else if (hostname.includes('flux') || hostname.includes('replicate')) {
            injectPromptFlux(prompt);
          }
          return;
        }

        if (attempt < 40) {
          console.log('[Content] ⚠️ No queued prompt found yet, retrying...');
          setTimeout(() => checkForQueuedPrompt(attempt + 1), 500);
        } else {
          console.log('[Content] ⚠️ No queued prompt found after extended retries');
        }
      }
    );
  })();

  // Also listen for direct messages from background (more reliable than short polling)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      console.log('[Content] Received runtime message:', msg);
      if (msg && msg.type === 'IMPORT_COMPLETE') {
        console.log('[Content] IMPORT_COMPLETE received, hiding loader');
        hideLoader();
        sendResponse({ success: true });
        return true;
      }
      if (msg && msg.type === 'QUEUED_PROMPT') {
        const { prompt, provider } = msg.data || {};
        const hostname = window.location.hostname;
        console.log('[Content] QUEUED_PROMPT received via onMessage, provider:', provider, 'hostname:', hostname);
        if (hostname.includes('gemini.google.com')) {
          injectPromptGemini(prompt);
        } else if (hostname.includes('flux') || hostname.includes('replicate')) {
          injectPromptFlux(prompt);
        }
      }
    } catch (e) {
      console.warn('[Content] Error handling runtime message', e);
    }
  });

  // End initialization IIFE

  /**
   * Automation for Google Gemini
   * Locates the prompt input field, enters the prompt, and submits
   * Uses icon-based detection to ensure proper synchronization
   */
  /**
   * SPEC 3: Safe Prompt Ingestion Guards
   * Automati on for Google Gemini
   * Locates the prompt input field, enters the prompt, and submits
   */
  function injectPromptGemini(prompt) {
    console.log("[Content] 🚀 Starting Gemini automation...");
    showLoader(); // Show loader animation during word list import

    // SPEC 3: Strict safeguard validation block
    // Verify that the prompt is a valid, non-empty string and does NOT equal "undefined" or "null"
    if (!prompt ||
      typeof prompt !== 'string' ||
      prompt.trim().length === 0 ||
      prompt === "undefined" ||
      prompt === "null") {
      console.error("[Content] ❌ ABORT: Invalid prompt detected");
      console.error("[Content] Prompt type:", typeof prompt);
      console.error("[Content] Prompt length:", prompt ? prompt.length : 0);
      console.error("[Content] Prompt value:", prompt);
      console.error("[Content] Prompt === 'undefined':", prompt === "undefined");
      console.error("[Content] Prompt === 'null':", prompt === "null");
      console.error("[Content] Falsy check (!prompt):", !prompt);
      hideLoader(); // Hide loader on error
      return;
    }

    console.log("[Content] ✅ Prompt validation passed, length:", prompt.length);
    console.log("[Content] Prompt preview:", prompt.substring(0, 150) + "...");

    // Wait for the Gemini interface to be ready
    console.log('[Content] ⏳ Waiting for Gemini input field (polling every 500ms)...');
    const waitForGemini = setInterval(() => {
      let promptInput = null;

      // FIX #2: Improved input selector with stable containers
      // Try multiple selectors for better reliability across Gemini updates
      promptInput = document.querySelector('div[contenteditable="true"], textarea, .input-area-container div[role="textbox"]');

      // Fallback: Try to find textarea with "Ask" placeholder
      if (!promptInput) {
        const textareas = document.querySelectorAll("textarea");
        promptInput = Array.from(textareas).find(
          (ta) => ta.placeholder?.includes("Ask") || ta.getAttribute("aria-label")?.includes("Ask")
        );
      }

      // Fallback: Try contenteditable div (Gemini might use this)
      if (!promptInput) {
        const editables = document.querySelectorAll("[contenteditable='true']");
        promptInput = Array.from(editables).find(
          (el) => el.getAttribute("aria-label")?.includes("Ask") ||
            el.className?.includes("input") ||
            el.className?.includes("prompt")
        );
      }

      if (promptInput) {
        clearInterval(waitForGemini);
        console.log("[Content] ✅ Found Gemini prompt input:", promptInput.tagName);

        // Focus and populate with strict event sequence
        promptInput.focus();
        promptInput.dispatchEvent(new Event('focus', { bubbles: true }));

        try {
          if ('value' in promptInput) {
            promptInput.value = prompt;
          } else if (promptInput.isContentEditable || promptInput.getAttribute && promptInput.getAttribute('contenteditable') === 'true') {
            promptInput.innerText = prompt;
          } else if (promptInput.textContent !== undefined) {
            promptInput.textContent = prompt;
          } else {
            // Last resort: try execCommand insertText
            try { document.execCommand('insertText', false, prompt); } catch (e) { /* ignore */ }
          }
        } catch (err) {
          console.warn('[Content] Warning: failed to set prompt text directly, continuing', err);
        }

        console.log("[Content] ✅ Prompt text injected into input field");

        // Strict event dispatch sequence for Gemini's internal framework
        // Dispatch input/change and keyboard events to notify frameworks
        promptInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        promptInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        promptInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
        promptInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        promptInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Enter' }));

        console.log("[Content] ✅ Events dispatched, waiting for arrow_upward icon...");

        // Wait for the submit button to be ready
        waitForSubmitButtonReady();
      }
    }, 500);

    // Safety timeout: stop waiting after 30 seconds
    setTimeout(() => {
      clearInterval(waitForGemini);
      hideLoader(); // Hide loader on timeout
      console.error("[Content] ❌ Timeout: Could not find Gemini prompt input after 30 seconds");
    }, 30000);
  }

  /**
   * Wait for the submit button with arrow_upward icon to appear and become active
   * Only then trigger the click to submit the prompt
   */
  /**
   * SPEC 3: Wait for submit button to be ready
   * Target Gemini's Material Icon element with arrow_upward attribute
   */
  function waitForSubmitButtonReady() {
    console.log("[Content] ⏳ Waiting for submit button to be ready...");

    let checkCount = 0;
    const maxChecks = 100; // 30 seconds at 300ms intervals

    const checkSubmitButton = setInterval(() => {
      checkCount++;

      // SPEC 3: Target Material Icon element - exclusively target Gemini's modern UI layout
      // Search for the Material Icon element: mat-icon[fonticon="arrow_upward"] or data-mat-icon-name="arrow_upward"
      const arrowButton = findArrowUpwardButton();

      if (arrowButton) {
        clearInterval(checkSubmitButton);
        console.log("[Content] ✅ Submit button READY at check #" + checkCount);
        console.log("[Content] 🖱️ Triggering submit click...");

        try {
          arrowButton.click();
          console.log("[Content] ✅ Submit button clicked successfully");

          // Start watching for response
          waitForResponse();
        } catch (err) {
          console.error("[Content] ❌ Error clicking submit button:", err);
        }
        return;
      }

      if (checkCount > maxChecks) {
        clearInterval(checkSubmitButton);
        hideLoader(); // Hide loader on timeout
        console.error("[Content] ❌ TIMEOUT: Submit button not found after " + maxChecks + " checks (~30 seconds)");
      }
    }, 300);
  }

  /**
   * SPEC 3: Find the button containing the arrow_upward icon
   * Exclusively target Gemini's modern UI layout
   */
  function findArrowUpwardButton() {
    // Strategy 1: Look for mat-icon with fonticon="arrow_upward"
    let arrowIcon = document.querySelector('mat-icon[fonticon="arrow_upward"]');
    if (arrowIcon) {
      const button = arrowIcon.closest('button');
      if (button && !button.disabled) {
        console.log("[Content] Found arrow_upward button via fonticon attribute");
        return button;
      }
    }

    // Strategy 2: Look for mat-icon with data-mat-icon-name="arrow_upward"
    arrowIcon = document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');
    if (arrowIcon) {
      const button = arrowIcon.closest('button');
      if (button && !button.disabled) {
        console.log("[Content] Found arrow_upward button via data-mat-icon-name");
        return button;
      }
    }

    // Strategy 3: Look for mat-icon with class containing arrow_upward
    const icons = document.querySelectorAll('mat-icon');
    for (const icon of icons) {
      if (icon.innerHTML.includes('arrow_upward') || icon.textContent.includes('arrow_upward')) {
        const button = icon.closest('button');
        if (button && !button.disabled) {
          console.log("[Content] Found arrow_upward button via content matching");
          return button;
        }
      }
    }

    return null;
  }

  /**
   * Automation for Flux (Replicate or other Flux interfaces)
   * Locates the prompt input, enters the prompt, and submits
   */
  function injectPromptFlux(prompt) {
    console.log("[Content] Starting Flux automation...");

    // Wait for Flux interface to be ready
    const waitForFlux = setInterval(() => {
      // Common patterns for Flux input fields
      const inputs = document.querySelectorAll("input, textarea");
      const promptInput = Array.from(inputs).find(
        (inp) => inp.placeholder?.toLowerCase().includes("prompt") ||
          inp.getAttribute("aria-label")?.toLowerCase().includes("prompt")
      );

      if (promptInput) {
        clearInterval(waitForFlux);
        console.log("[Content] Found Flux prompt input");

        // Focus and populate
        promptInput.focus();
        promptInput.value = prompt;

        // Trigger change events
        promptInput.dispatchEvent(
          new Event("input", { bubbles: true, cancelable: true })
        );
        promptInput.dispatchEvent(
          new Event("change", { bubbles: true, cancelable: true })
        );

        // Find and click generate button
        setTimeout(() => {
          const generateButton = findGenerateButton();
          if (generateButton) {
            console.log("[Content] Clicking generate button...");
            generateButton.click();

            // Start watching for response
            waitForResponse();
          } else {
            console.error("[Content] Could not find generate button");
          }
        }, 500);
      }
    }, 500);

    // Safety timeout
    setTimeout(() => {
      clearInterval(waitForFlux);
    }, 30000);
  }

  /**
   * Find the submit button for Gemini
   * Updated to handle Gemini's modern layout with SVG icons and aria-labels
   */
  function findSubmitButton() {
    console.log("[Content] Searching for Gemini submit button...");

    const buttons = document.querySelectorAll("button");

    // Strategy 1: Look for aria-label containing "Send message"
    let submitButton = Array.from(buttons).find(
      (btn) => btn.getAttribute("aria-label")?.includes("Send message")
    );

    if (submitButton) {
      console.log("[Content] FOUND: Submit button via aria-label 'Send message'");
      return submitButton;
    }

    // Strategy 2: Look for aria-label containing "Submit"
    submitButton = Array.from(buttons).find(
      (btn) => btn.getAttribute("aria-label")?.includes("Submit")
    );

    if (submitButton) {
      console.log("[Content] FOUND: Submit button via aria-label 'Submit'");
      return submitButton;
    }

    // Strategy 3: Look for button with mat-icon containing send icon
    submitButton = Array.from(buttons).find(
      (btn) => btn.querySelector("mat-icon[fonticon='send']") !== null
    );

    if (submitButton) {
      console.log("[Content] FOUND: Submit button via mat-icon[fonticon='send']");
      return submitButton;
    }

    // Strategy 4: Last resort - find the last button in the input container
    // Gemini typically has the submit button as the last interactive element
    const inputContainer = document.querySelector(
      ".input-area-container, [class*='input-container'], [class*='prompt-container']"
    );

    if (inputContainer) {
      const containerButtons = inputContainer.querySelectorAll("button");
      if (containerButtons.length > 0) {
        submitButton = containerButtons[containerButtons.length - 1];
        console.log("[Content] FOUND: Submit button as last button in input container");
        return submitButton;
      }
    }

    // Fallback: text-based search (less reliable but better than nothing)
    submitButton = Array.from(buttons).find(
      (btn) =>
        btn.textContent.toLowerCase().includes("send") ||
        btn.textContent.toLowerCase().includes("generate") ||
        btn.textContent.toLowerCase().includes("submit")
    );

    if (submitButton) {
      console.log("[Content] FOUND: Submit button via text content fallback");
      return submitButton;
    }

    console.error("[Content] Could not find submit button using any strategy");
    return null;
  }

  /**
   * Find the generate button (Flux-specific)
   */
  function findGenerateButton() {
    const buttons = document.querySelectorAll("button");
    return Array.from(buttons).find(
      (btn) =>
        btn.textContent.toLowerCase().includes("generate") ||
        btn.textContent.toLowerCase().includes("create")
    );
  }

  /**
   * SPEC 4: Dynamic Response Observation Loop
   * Optimized polling with 1.5-second intervals
   * 
   * Wait for Gemini response completion and extract the generated content
   * Uses interval-based scanning for the action toolbar container
   */
  function waitForResponse() {
    console.log("[Content] 📊 SPEC 4: Starting dynamic response observation...");

    let responseProcessed = false;
    let scanCount = 0;
    const maxScans = 200; // 5 minutes at 1.5-second intervals ≈ 200 scans
    const pollingInterval = 1500; // SPEC 4: 1.5 seconds (optimized from 2s)

    const scanInterval = setInterval(() => {
      if (responseProcessed) {
        clearInterval(scanInterval);
        return;
      }

      scanCount++;

      // Monitor for response completion — actions toolbar or model message content
      const actionsContainer = document.querySelector('div[class*="actions-container"]');
      const modelResponse = document.querySelector('[data-message-author-role="model"], message-content, .model-response-text');
      const copyButton = findCopyButton();

      if (actionsContainer || modelResponse || copyButton) {
        console.log("[Content] ✅ Response detected at scan #" + scanCount + " (~" + Math.round(scanCount * 1.5) + "s)");
        console.log("[Content] 🔍 Locating copy button...");

        responseProcessed = true;
        clearInterval(scanInterval);

        const resolvedCopyButton = copyButton || (actionsContainer && actionsContainer.querySelector(
          'copy-button button, button[aria-label="Copy"], button[data-test-id="copy-button"]'
        ));

        if (resolvedCopyButton) {
          console.log("[Content] ✅ Copy button located");

          setTimeout(() => {
            try {
              console.log("[Content] 📋 Triggering programmatic .click()");
              resolvedCopyButton.click();
              console.log("[Content] ✅ Copy command executed");

              setTimeout(() => {
                console.log("[Content] 📝 Reading from navigator.clipboard...");
                readAndSendClipboard();
              }, 300);
            } catch (err) {
              console.error("[Content] ❌ Copy click failed:", err);
              console.log("[Content] Falling back to DOM text extraction...");
              const domRawText = extractGeminiRawResponseText();
              if (domRawText && domRawText.length > 0) {
                sendParsedTextResponse(domRawText);
              }
            }
          }, 100);
          return;
        } else {
          console.warn("[Content] ⚠️ Copy button not found — using DOM text extraction");
          const domRawText = extractGeminiRawResponseText();
          if (domRawText && domRawText.length > 0) {
            sendParsedTextResponse(domRawText);
          } else {
            const textContent = extractAndCleanTextContentGemini();
            if (textContent) {
              sendTextBack(textContent);
            }
          }
          return;
        }
      }

      // SPEC 4: Timeout check - maximum scans exceeded
      if (scanCount > maxScans) {
        responseProcessed = true;
        clearInterval(scanInterval);
        console.error("[Content] ❌ TIMEOUT: Response not detected after " + scanCount + " scans (~" + Math.round(scanCount * 1.5 / 60) + " minutes)");

        // Final fallback: DOM extraction
        const textContent = extractAndCleanTextContentGemini();
        if (textContent && textContent.length > 0) {
          console.log("[Content] Sending timeout-extracted content from DOM");
          sendTextBack(textContent);
        } else {
          hideLoader(); // Hide loader on error
          chrome.runtime.sendMessage({
            type: "RESPONSE_GENERATED",
            error: "Response generation timeout - could not locate actions container",
          });
        }
      }
    }, pollingInterval); // SPEC 4: Scan every 1.5 seconds (optimized)

    // Absolute safety timeout (5 minutes)
    setTimeout(() => {
      if (!responseProcessed) {
        responseProcessed = true;
        clearInterval(scanInterval);
        hideLoader(); // Hide loader on timeout
        console.error("[Content] Absolute timeout (5 minutes) - forcing cleanup");
        chrome.runtime.sendMessage({
          type: "RESPONSE_GENERATED",
          error: "Response generation absolute timeout",
        });
      }
    }, 300000);
  }

  /**
   * Step 4.5: Enhanced Clipboard Reading with DOM Fallback
   * Extracts response text and sends it back to background script
   */


  /**
   * Read text from clipboard and send it back
   * Uses modern Clipboard API with comprehensive error handling
   */
  async function readAndSendClipboard() {
    console.log("[Content] Reading clipboard with strict line filter...");

    setTimeout(async () => {
      try {
        const rawText = await navigator.clipboard.readText();
        if (!rawText) {
          console.warn("[Content] Clipboard returned no text — trying DOM extraction.");
          const domRawText = extractGeminiRawResponseText();
          if (domRawText && domRawText.length > 0) {
            sendParsedTextResponse(domRawText);
          }
          return;
        }
        console.log("[Content] Clipboard text successfully intercepted while focused.");
        console.log("[Content] Raw clipboard length:", rawText.length);
        console.log("[Content] Raw clipboard preview:", rawText.substring(0, 300) + "...");
        sendParsedTextResponse(rawText);
      } catch (err) {
        console.error("[Content] Clipboard execution error caught safely:", err);
        console.log("[Content] Falling back to DOM text extraction after clipboard failure...");
        const domRawText = extractGeminiRawResponseText();
        if (domRawText && domRawText.length > 0) {
          sendParsedTextResponse(domRawText);
        } else {
          hideLoader();
          chrome.runtime.sendMessage({
            type: "RESPONSE_GENERATED",
            error: "Could not read clipboard or extract response from Gemini page",
          });
        }
      }
    }, 500);
  }

  /**
   * Strip numbered list prefixes and return clean word tokens from a line
   */
  function normalizeWordToken(token) {
    return token.trim().replace(/^\d+\.\s*/, '').trim();
  }

  /**
   * Parse raw Gemini text into word lines, fun facts, and title for RESPONSE_GENERATED
   */
  function sendParsedTextResponse(rawText) {
    const allLines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let themeTitle = '';
    for (const line of allLines) {
      if (line.startsWith('-') && !line.toLowerCase().startsWith('-fun fact')) {
        themeTitle = line.replace(/^-+\s*/, '').trim();
        break;
      }
    }
    if (!themeTitle && allLines.length > 0) {
      for (const line of allLines) {
        const lower = line.toLowerCase();
        if (!line.includes(',') && !lower.startsWith('-fun fact') && !lower.startsWith('fun fact')) {
          themeTitle = line.replace(/^-+\s*/, '').trim();
          break;
        }
      }
    }

    const wordLines = [];
    const funFactLines = [];
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const lineLower = line.toLowerCase();
      if (lineLower.startsWith('-fun fact') || lineLower.startsWith('fun fact')) {
        funFactLines.push(line);
      } else if (line.startsWith('-') && !line.includes(',')) {
        // theme line
      } else if (line.includes(',')) {
        wordLines.push(line);
      }
    }

    const filteredLines = wordLines
      .flatMap(line => line.split(','))
      .map(normalizeWordToken)
      .filter(word => word.length > 0 && !/^\d+$/.test(word))
      .join('\n');

    const funFacts = funFactLines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    chrome.runtime.sendMessage({
      type: "RESPONSE_GENERATED",
      textData: filteredLines,
      funFacts: funFacts || '',
      title: themeTitle || '',
      rawText: rawText,
    });
  }

  /**
   * Extract the latest model response as plain text from the Gemini DOM
   */
  function extractGeminiRawResponseText() {
    const selectors = [
      '[data-message-author-role="model"]',
      'message-content',
      '.model-response-text',
      '[class*="model-response"]',
      '[class*="response-container"]',
      'div[class*="markdown"]',
    ];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length > 0) {
        const text = nodes[nodes.length - 1].innerText || nodes[nodes.length - 1].textContent || '';
        if (text.trim().length > 20) {
          console.log('[Content] Extracted Gemini response via selector:', selector);
          return text.trim();
        }
      }
    }

    const regions = document.querySelectorAll('[role="region"]');
    for (let i = regions.length - 1; i >= 0; i--) {
      const text = regions[i].innerText || '';
      if (text.includes(',') && (text.toLowerCase().includes('fun fact') || text.split(',').length >= 3)) {
        return text.trim();
      }
    }

    return null;
  }

  function findCopyButton() {
    const selectors = [
      'copy-button button',
      'button[aria-label="Copy"]',
      'button[aria-label*="Copy"]',
      'button[data-test-id="copy-button"]',
      'button[aria-label*="copy"]',
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn;
    }

    const actionsContainer = document.querySelector('div[class*="actions-container"]');
    if (actionsContainer) {
      const btn = actionsContainer.querySelector('button');
      if (btn) return btn;
    }

    return null;
  }

  /**
   * Parse Gemini clipboard text into structured format
   */
  function parseGeminiClipboardText(clipboardText) {
    try {
      // Remove markdown syntax
      let cleaned = clipboardText
        .replace(/\*\*(.+?)\*\*/g, "$1") // Bold **text**
        .replace(/__(.+?)__/g, "$1") // Bold __text__
        .replace(/\*(.+?)\*/g, "$1") // Italic *text*
        .replace(/_(.+?)_/g, "$1") // Italic _text_
        .replace(/~~(.+?)~~/g, "$1") // Strikethrough ~~text~~
        .replace(/`(.+?)`/g, "$1") // Code `text`
        .replace(/```[\s\S]*?```/g, "") // Code blocks
        .replace(/^#+\s+/gm, "") // Headers
        .replace(/\[(.+?)\]\(.+?\)/g, "$1"); // Links

      // Split into lines and clean
      const lines = cleaned
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.includes('©') && !line.match(/\d{4}\s*-\s*present|copyright/i));

      // Parse structured data
      const parsedData = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if line is a theme title
        if (isThemeTitle(line)) {
          const nextLine = lines[i + 1];

          // Check if next line is a word list
          if (nextLine && isWordList(nextLine)) {
            const words = cleanWords(nextLine);
            parsedData.push({
              theme: line,
              words: words,
            });
            i++;
          }
        }
      }

      console.log("[Content] Parsed clipboard data:", parsedData);
      return parsedData.length > 0 ? parsedData : null;
    } catch (error) {
      console.error("[Content] Error parsing clipboard text:", error);
      return null;
    }
  }

  /**
   * Extract and clean text content from Gemini response area
   * Specifically targets Gemini's message container to avoid UI text
   * Focuses on Theme + word list format: "Theme Title" followed by "word, word, word..."
   */
  function extractAndCleanTextContentGemini() {
    try {
      // Find Gemini's message container - usually has role="region" or data-* attributes
      let responseContainer = null;

      // Try to find by role
      const regions = document.querySelectorAll('[role="region"]');
      for (const region of regions) {
        const text = region.textContent.toLowerCase();
        if (text.includes('word') || text.includes('list') || text.includes(',')) {
          responseContainer = region;
          break;
        }
      }

      // Fallback: Find the last message-like div (Gemini's typical structure)
      if (!responseContainer) {
        const messages = document.querySelectorAll('[data-message-id], [class*="message"]');
        if (messages.length > 0) {
          responseContainer = messages[messages.length - 1];
        }
      }

      // If still not found, use body but be more selective
      if (!responseContainer) {
        responseContainer = document.body;
      }

      // Extract text from container
      const walker = document.createTreeWalker(
        responseContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const lines = [];
      let node;

      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        // Filter out very short text (likely UI elements)
        if (text.length > 0 && text.length < 500) {
          lines.push(text);
        }
      }

      // Join and clean the content
      let rawContent = lines.join("\n");

      // Remove markdown syntax (**, __, ~~, etc.)
      rawContent = rawContent
        .replace(/\*\*(.+?)\*\*/g, "$1") // Bold **text**
        .replace(/__(.+?)__/g, "$1") // Bold __text__
        .replace(/\*(.+?)\*/g, "$1") // Italic *text*
        .replace(/_(.+?)_/g, "$1") // Italic _text_
        .replace(/~~(.+?)~~/g, "$1") // Strikethrough ~~text~~
        .replace(/`(.+?)`/g, "$1") // Code `text`
        .replace(/```[\s\S]*?```/g, "") // Code blocks
        .replace(/^#+\s+/gm, "") // Headers
        .replace(/\[(.+?)\]\(.+?\)/g, "$1"); // Links

      // Split into lines and process
      const cleanedLines = rawContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.includes('©') && !line.includes('2024'));

      // Parse structured data: Theme Title followed by words
      const parsedData = [];

      for (let i = 0; i < cleanedLines.length; i++) {
        const line = cleanedLines[i];

        // Check if line looks like a theme title (short text, not a sentence)
        if (isThemeTitle(line)) {
          const nextLine = cleanedLines[i + 1];

          // Check if next line is a word list (comma-separated words)
          if (nextLine && isWordList(nextLine)) {
            const words = cleanWords(nextLine);
            parsedData.push({
              theme: line,
              words: words,
            });
            i++; // Skip the next line since we processed it
          }
        }
      }

      // If we found structured data, return it
      if (parsedData.length > 0) {
        console.log("[Content] Parsed structured data:", parsedData);
        return parsedData;
      }

      // Fallback: return raw cleaned content if no structure found
      if (cleanedLines.length > 0) {
        console.log("[Content] Returning raw cleaned content:", cleanedLines);
        return cleanedLines;
      }

      return null;
    } catch (error) {
      console.error("[Content] Error extracting text:", error);
      return null;
    }
  }

  /**
   * Determine if a line is a theme title (more forgiving validation)
   */
  function isThemeTitle(line) {
    // Remove excessive spaces
    line = line.trim();
    if (line.length === 0) return false;

    // Theme titles are typically short (2-15 words) - more forgiving than before
    const words = line.split(/\s+/);
    if (words.length > 15) return false;

    // Don't require exact capitalization - accept any case
    // More forgiving validation

    // Allow titles with some punctuation (like "&" or numbers)
    // More forgiving: allow almost anything that's not clearly a long sentence
    const endsWithSentencePunctuation = /[.!?;:]$/.test(line);
    if (endsWithSentencePunctuation && !line.includes(',')) return false;

    // Likely a title if it's reasonably short and not a full sentence
    return line.length > 1 && line.length < 100;
  }

  /**
   * Determine if a line is a word list (more forgiving validation)
   */
  function isWordList(line) {
    line = line.trim();
    if (line.length === 0) return false;

    // Check for commas OR multiple spaces (both indicate word lists)
    const commaCount = (line.match(/,/g) || []).length;
    const multipleSpaces = /\s{2,}/.test(line);

    // More forgiving: accept if has commas OR multiple consecutive spaces
    if (commaCount < 1 && !multipleSpaces) return false;

    // Extract potential words (split by comma or multiple spaces)
    const separator = commaCount > 0 ? ',' : /\s{2,}/;
    const potentialWords = line.split(separator).map((w) => w.trim()).filter(w => w.length > 0);

    // Should have at least 3 items to be considered a word list
    if (potentialWords.length < 3) return false;

    // Most items should be reasonably short (words, not long phrases)
    // More forgiving: allow items up to 40 chars instead of 30
    const shortItems = potentialWords.filter((w) => w.length < 40).length;
    return shortItems >= potentialWords.length * 0.7; // Lower threshold: 70% instead of 80%
  }

  /**
   * Clean and normalize word list
   */
  function cleanWords(wordListString) {
    return wordListString
      .split(",")
      .map((word) => word.trim().replace(/^\d+\.\s*/, "").toLowerCase())
      .filter((word) => word.length > 0 && !/^\d+$/.test(word)) // Remove empty and number-only
      .filter((word) => !/^(the|a|an|and|or|but|in|on|at|to|for)$/.test(word)); // Remove common words
  }

  /**
   * Extract image data from img or canvas element and send back
   */
  function extractAndSendImage(imageElement) {
    let imageData = null;
    let mediaType = "image/png";

    try {
      if (imageElement.tagName === "IMG") {
        const src = imageElement.src;

        if (src.startsWith("blob:")) {
          // Handle blob URLs by fetching and converting to base64
          fetch(src)
            .then((response) => response.blob())
            .then((blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                imageData = reader.result;
                sendImageBack(imageData, mediaType);
              };
              reader.readAsDataURL(blob);
              mediaType = blob.type || "image/png";
            });
        } else if (src.startsWith("data:")) {
          // Data URL - send directly
          imageData = src;
          sendImageBack(imageData, mediaType);
        } else {
          // Regular URL - fetch and convert
          fetch(src)
            .then((response) => response.blob())
            .then((blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                imageData = reader.result;
                sendImageBack(imageData, mediaType);
              };
              reader.readAsDataURL(blob);
              mediaType = blob.type || "image/png";
            });
        }
      } else if (imageElement.tagName === "CANVAS") {
        imageData = imageElement.toDataURL("image/png");
        mediaType = "image/png";
        sendImageBack(imageData, mediaType);
      }
    } catch (error) {
      console.error("[Content] Error extracting image:", error);
      chrome.runtime.sendMessage({
        type: "RESPONSE_GENERATED",
        error: `Image extraction failed: ${error.message}`,
      });
    }
  }

  /**
   * Send extracted image back to background script
   */
  function sendImageBack(imageData, mediaType) {
    console.log("[Content] Sending image back to background script...");
    console.log(
      "[Content] Image data size:",
      imageData ? imageData.length : 0,
      "bytes"
    );

    chrome.runtime.sendMessage(
      {
        type: "RESPONSE_GENERATED",
        dataType: "image",
        imageData,
        mediaType,
        timestamp: Date.now(),
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Content] Error sending image:",
            chrome.runtime.lastError
          );
        } else {
          console.log("[Content] Image sent successfully");
        }
      }
    );
  }

  /**
   * Send extracted text back to background script
   */
  // FIX #3: Global completion flag to signal successful response and prevent further loops
  let responseCompletionSignaled = false;

  function sendTextBack(textData) {
    console.log("[Content] Sending text back to background script...");
    console.log("[Content] Text data:", textData);

    if (responseCompletionSignaled) {
      console.log("[Content] Response already sent, ignoring duplicate send");
      return;
    }

    responseCompletionSignaled = true;
    console.log("[Content] ✅ Completion signal set - response will be sent");

    // If structured array from DOM parser, convert to raw text and send with metadata
    if (Array.isArray(textData)) {
      const rawParts = [];
      for (const block of textData) {
        if (block && block.theme) rawParts.push('-' + block.theme);
        if (block && block.words && Array.isArray(block.words)) {
          rawParts.push(block.words.map((w, idx) => `${idx + 1}.${w}`).join(', '));
        }
      }
      const rawText = rawParts.join('\n');
      if (rawText.length > 0) {
        sendParsedTextResponse(rawText);
        return;
      }
    }

    const payload = typeof textData === 'string'
      ? { rawText: textData }
      : { textData };

    chrome.runtime.sendMessage(
      {
        type: "RESPONSE_GENERATED",
        dataType: "text",
        ...payload,
        timestamp: Date.now(),
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Content] Error sending text:",
            chrome.runtime.lastError
          );
          responseCompletionSignaled = false; // Reset on error to allow retry
        } else {
          console.log("[Content] ✅ Text sent successfully - completion signaled to background");
        }
      }
    );
  }

  // Close IIFE wrapper to enable guard flag return statement
})();
