/**
 * GenPuzzle Dashboard Content Script
 * 
 * Responsibilities:
 * - Listen for PASTE_DATA messages from background script
 * - Extract word pattern lines (comma-separated format)
 * - Inject raw word patterns directly into "Your Words" textarea
 * - Trigger React state updates via native events
 */

console.log("[GenPuzzle Content] Script loaded on", window.location.hostname);

let currentRequestId = null;
let genPuzzleLoaderOverlay = null;

function createGenPuzzleLoaderOverlay() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      try { createGenPuzzleLoaderOverlay(); } catch (e) { /* ignore */ }
    });
    return;
  }

  if (document.getElementById('genpuzzle-wait-loader-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'genpuzzle-wait-loader-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0, 0, 0, 0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '999999';
  overlay.style.pointerEvents = 'none';

  const style = document.createElement('style');
  style.textContent = `
    .loader-wrapper{position:relative;display:flex;align-items:center;justify-content:center;height:120px;width:auto;margin:2rem;font-family:"Poppins",sans-serif;font-size:1.6em;font-weight:600;user-select:none;color:#fff;scale:2}
    .loader{position:absolute;top:0;left:0;height:100%;width:100%;z-index:1;background-color:transparent;mask:repeating-linear-gradient(90deg,transparent 0,transparent 6px,black 7px,black 8px)}
    .loader::after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background-image:radial-gradient(circle at 50% 50%,#ff0 0%,transparent 50%),radial-gradient(circle at 45% 45%,#f00 0%,transparent 45%),radial-gradient(circle at 55% 55%,#0ff 0%,transparent 45%),radial-gradient(circle at 45% 55%,#0f0 0%,transparent 45%),radial-gradient(circle at 55% 45%,#00f 0%,transparent 45%);mask:radial-gradient(circle at 50% 50%,transparent 0%,transparent 10%,black 25%);animation:transform-animation 2s infinite alternate,opacity-animation 4s infinite;animation-timing-function:cubic-bezier(0.6,0.8,0.5,1)}
    @keyframes transform-animation{0%{transform:translate(-55%)}100%{transform:translate(55%)}}
    @keyframes opacity-animation{0%,100%{opacity:0}15%{opacity:1}65%{opacity:0}}
    .loader-letter{display:inline-block;opacity:0;animation:loader-letter-anim 4s infinite linear;z-index:2}
    .loader-letter:nth-child(1){animation-delay:0.1s}.loader-letter:nth-child(2){animation-delay:0.205s}.loader-letter:nth-child(3){animation-delay:0.31s}.loader-letter:nth-child(4){animation-delay:0.415s}.loader-letter:nth-child(5){animation-delay:0.521s}.loader-letter:nth-child(6){animation-delay:0.626s}.loader-letter:nth-child(7){animation-delay:0.731s}.loader-letter:nth-child(8){animation-delay:0.837s}.loader-letter:nth-child(9){animation-delay:0.942s}.loader-letter:nth-child(10){animation-delay:1.047s}
    @keyframes loader-letter-anim{0%{opacity:0}5%{opacity:1;text-shadow:0 0 4px #fff;transform:scale(1.1) translateY(-2px)}20%{opacity:0.2}100%{opacity:0}}
  `;

  const wrapper = document.createElement('div');
  wrapper.className = 'loader-wrapper';

  const loader = document.createElement('div');
  loader.className = 'loader';

  const letters = document.createElement('div');
  const text = 'Wait a moment';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'loader-letter';
    span.textContent = ch;
    letters.appendChild(span);
  }

  wrapper.appendChild(loader);
  wrapper.appendChild(letters);
  overlay.appendChild(style);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
  genPuzzleLoaderOverlay = overlay;
}

function showWaitLoader() {
  if (!genPuzzleLoaderOverlay) {
    createGenPuzzleLoaderOverlay();
  }
  if (genPuzzleLoaderOverlay) {
    genPuzzleLoaderOverlay.style.display = 'flex';
    console.log('[GenPuzzle Content] ✅ Showing GenPuzzle Wait a moment loader');
  }
}

function hideWaitLoader() {
  if (genPuzzleLoaderOverlay) {
    genPuzzleLoaderOverlay.style.display = 'none';
    console.log('[GenPuzzle Content] ✅ Hiding GenPuzzle Wait a moment loader');
  }
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[GenPuzzle Content] Received message:", request.type);

  // Reset the generate button click flag for new requests
  if (request.type === "PASTE_DATA" || request.type === "PASTE_FUN_FACTS") {
    window.hasClickedGeneratePuzzles = false;
  }

  if (request.type === "PASTE_DATA") {
    currentRequestId = request.requestId || null;
    handlePasteData(request);
    sendResponse({ success: true });
  } else if (request.type === "PASTE_FUN_FACTS") {
    currentRequestId = request.requestId || currentRequestId;
    console.log("[GenPuzzle Content] PASTE_FUN_FACTS message received, ignoring since handled in PASTE_DATA");
    sendResponse({ success: true });
  }

  return true;
});

function isInformationalSentence(line) {
  const clean = line.replace(/^-+\s*/, '').trim();
  if (clean.length > 25 && /[.!?]$/.test(clean)) {
    return true;
  }
  const lower = clean.toLowerCase();
  if (lower.startsWith('did you know') || lower.startsWith('fact:') || lower.startsWith('fun fact:')) {
    return true;
  }
  return false;
}

function isWordListLine(line) {
  if (line.includes(',')) return true;
  if (!line.includes(' ') && line.length > 0) return true;
  return false;
}

function performStrictParsing(rawText, cleanWordsFallback = "", cleanFunFactsFallback = "", cleanTitleFallback = "") {
  console.log("[GenPuzzle Content] Running Stage 1: Strict Segmentation...");
  
  const textToParse = rawText || `${cleanTitleFallback}\n${cleanWordsFallback}\n${cleanFunFactsFallback}`;
  // Clean markdown out completely to prevent parsing errors
  let cleanedText = textToParse
    .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
    .replace(/__(.+?)__/g, "$1") // Bold
    .replace(/\*(.+?)\*/g, "$1") // Italic
    .replace(/_(.+?)_/g, "$1") // Italic
    .replace(/~~(.+?)~~/g, "$1") // Strikethrough
    .replace(/`(.+?)`/g, "$1") // Code
    .replace(/```[\s\S]*?```/g, "") // Code blocks
    .replace(/^#+\s+/gm, "") // Headers
    .replace(/\[(.+?)\]\(.+?\)/g, "$1"); // Links

  const lines = cleanedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let extractedTitleLines = [];
  let extractedWordLines = [];
  let extractedFunFactLines = [];

  // Stage 1: Strict Segmentation using Block Recognition
  // The user specifies a 3-line structure: Title (1), Words (2), Fun Fact (3).
  // We locate the "Words" line (contains commas) and map the surrounding lines.
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // A word line is typically the anchor: contains commas and is not a fun fact
    const isWordAnchor = line.includes(',') && !lowerLine.startsWith('-fun fact') && !lowerLine.startsWith('fun fact');
    
    // Check if we are at the start of a 3-line block:
    // This happens if the CURRENT line is Title, NEXT is Words.
    const nextLine = lines[i + 1] ? lines[i + 1].toLowerCase() : "";
    const isNextWordAnchor = lines[i + 1] && lines[i + 1].includes(',') && !nextLine.startsWith('-fun fact') && !nextLine.startsWith('fun fact');
    
    if (isNextWordAnchor) {
      // i is Title, i+1 is Words, i+2 is Fun Fact
      
      // 1. Title
      extractedTitleLines.push(lines[i].replace(/^-+\s*/, '').trim());
      
      // 2. Words
      extractedWordLines.push(lines[i + 1]);
      
      // 3. Fun Fact
      if (lines[i + 2]) {
        const funFactLine = lines[i + 2];
        const lowerFunFact = funFactLine.toLowerCase();
        if (lowerFunFact.startsWith('-fun fact') || lowerFunFact.startsWith('fun fact') || isInformationalSentence(funFactLine)) {
          extractedFunFactLines.push(funFactLine);
        }
      }
      
      i += 3; // Skip the whole block
    } else {
      // If we don't find the anchor pattern, check if it's a stray fun fact just in case
      if (lowerLine.startsWith('-fun fact') || lowerLine.startsWith('fun fact')) {
        extractedFunFactLines.push(line);
      }
      i++;
    }
  }

  // Fallback: If no blocks were found, fallback to pure line index parsing (1=Title, 2=Words, 3=Fun Facts)
  if (extractedWordLines.length === 0) {
    extractedTitleLines = [];
    // DO NOT wipe extractedFunFactLines here! The linear scan already reliably picked up lines starting with -Fun fact.
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lowerLine = line.toLowerCase();
      if (j % 3 === 0) {
         if (!lowerLine.startsWith('-fun fact') && !lowerLine.startsWith('fun fact')) {
             extractedTitleLines.push(line.replace(/^-+\s*/, '').trim());
         }
      }
      else if (j % 3 === 1 && !lowerLine.startsWith('-fun fact') && !lowerLine.startsWith('fun fact')) {
         extractedWordLines.push(line);
      }
    }
  }

  // Finalize Words Extraction
  const finalWords = [];
  for (const line of extractedWordLines) {
    if (line.includes(',')) {
      const parts = line.split(',').map(w => w.trim()).filter(w => w.length > 0);
      finalWords.push(...parts);
    } else {
      const clean = line.replace(/^\d+\.\s*/, '').trim();
      if (clean.length > 0) {
        finalWords.push(clean);
      }
    }
  }

  const cleanWordList = finalWords
    .map(w => w.replace(/^\d+\.\s*/, '').trim())
    .filter(w => w.length > 0 && !/^\d+$/.test(w))
    .join('\n');

  const cleanFunFacts = extractedFunFactLines
    .map(line => line.trim())
    .map(line => line.replace(/^-\s*fun fact:\s*/i, '').trim())
    .filter(line => line.length > 0)
    .join('\n');

  const cleanTitle = extractedTitleLines.join('\n');

  console.log("[GenPuzzle Content] Strict Segmentation Results:");
  console.log(" - Title:", cleanTitle);
  console.log(" - Word List Count:", cleanWordList ? cleanWordList.split('\n').length : 0);
  console.log(" - Fun Facts Count:", cleanFunFacts ? cleanFunFacts.split('\n').length : 0);

  return {
    title: cleanTitle || cleanTitleFallback,
    words: cleanWordList || cleanWordsFallback,
    funFacts: cleanFunFacts || cleanFunFactsFallback
  };
}

async function handlePasteData(request) {
  console.log("[GenPuzzle Content] Starting handlePasteData...");

  const rawText = request.rawText || "";
  const cleanWordsFallback = request.text || "";
  const cleanFunFactsFallback = request.funFacts || "";
  const cleanTitleFallback = request.title || "";

  const parsed = performStrictParsing(rawText, cleanWordsFallback, cleanFunFactsFallback, cleanTitleFallback);

  console.log("[GenPuzzle Content] Parsed fun facts:", parsed.funFacts ? parsed.funFacts.substring(0, 100) : "(empty)");
  console.log("[GenPuzzle Content] Parsed words:", parsed.words ? parsed.words.substring(0, 100) : "(empty)");
  console.log("[GenPuzzle Content] Parsed title:", parsed.title ? parsed.title.substring(0, 100) : "(empty)");

  // Notify React app listeners as a backup to DOM injection
  if (parsed.words) {
    document.dispatchEvent(new CustomEvent('genpuzzle-paste-data', { detail: { text: parsed.words } }));
  }
  if (parsed.funFacts) {
    document.dispatchEvent(new CustomEvent('genpuzzle-paste-fun-facts', { detail: { text: parsed.funFacts } }));
  }
  window.postMessage({
    type: 'GENPUZZLE_RESPONSE',
    data: {
      action: 'GENERATE_WORDS',
      dataType: 'text',
      requestId: currentRequestId,
      words: parsed.words ? parsed.words.split('\n').filter(Boolean).map(w => ({ theme: '', words: [w] })) : [],
      textData: parsed.words,
      funFacts: parsed.funFacts,
      title: parsed.title,
    },
  }, '*');

  // ─── Helper: native React-aware textarea injection ───────────────────────
  const injectTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  };

  // ─── Helper: find tab button by title attribute ───────────────────────────
  const clickTab = async (title) => {
    const tab = document.querySelector(`[role="tab"][title="${title}"]`);
    if (!tab) {
      console.warn(`[GenPuzzle Content] Tab "${title}" not found`);
      return;
    }
    if (tab.getAttribute('data-state') === 'active') {
      console.log(`[GenPuzzle Content] Tab "${title}" already active`);
      return;
    }
    console.log(`[GenPuzzle Content] Clicking tab "${title}"...`);
    tab.click();
    // Wait for React to mount the tab content
    await new Promise(r => setTimeout(r, 300));
  };

  // ─── Helper: poll for an element ─────────────────────────────────────────
  const waitForElement = (selector, timeout = 3000) => {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) { resolve(el); return; }

      const interval = setInterval(() => {
        const found = document.querySelector(selector);
        if (found) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(found);
        }
      }, 80);

      const timer = setTimeout(() => {
        clearInterval(interval);
        console.warn(`[GenPuzzle Content] Timed out waiting for: ${selector}`);
        resolve(null);
      }, timeout);
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Inject Words
  // ══════════════════════════════════════════════════════════════════════════
  await clickTab('Words');

  const wordsTextarea = await waitForElement('textarea[placeholder*="one word per line"]') ||
                        await waitForElement('textarea');
  if (wordsTextarea) {
    console.log("[GenPuzzle Content] ✅ Injecting words...");
    injectTextarea(wordsTextarea, parsed.words);
  } else {
    console.error("[GenPuzzle Content] ❌ Words textarea not found");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Switch to Design tab
  // ══════════════════════════════════════════════════════════════════════════
  await clickTab('Design');

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Inject Titles
  // ══════════════════════════════════════════════════════════════════════════
  await ensureCustomTitleSelected();

  const titleTextarea = await waitForElement('textarea[placeholder="Enter one title per line..."]');
  if (titleTextarea) {
    console.log("[GenPuzzle Content] ✅ Injecting titles...");
    injectTextarea(titleTextarea, parsed.title);
  } else {
    console.warn("[GenPuzzle Content] Title textarea not found");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Enable "Add Fun Facts / Quotes" checkbox
  // ══════════════════════════════════════════════════════════════════════════
  const checkbox =
    document.getElementById('includeFunFacts1') ||
    document.getElementById('includeFunFacts') ||
    document.querySelector('[id^="includeFunFacts"]');
  if (checkbox) {
    const isChecked = checkbox.getAttribute('aria-checked') === 'true' || checkbox.checked === true;
    if (!isChecked) {
      console.log("[GenPuzzle Content] Enabling includeFunFacts checkbox...");
      checkbox.click();
      await new Promise(r => setTimeout(r, 200));
    } else {
      console.log("[GenPuzzle Content] includeFunFacts already enabled");
    }
  } else {
    console.warn("[GenPuzzle Content] includeFunFacts checkbox not found by ID — trying label click");
    const funFactsLabel = Array.from(document.querySelectorAll('label')).find(
      l => l.textContent && l.textContent.includes('Fun Facts')
    );
    if (funFactsLabel) {
      funFactsLabel.click();
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: Wait for fun facts textarea to appear, then inject
  // ══════════════════════════════════════════════════════════════════════════
  const funFactsTextarea = await waitForElement('textarea[placeholder="Enter one fun fact or quote per line..."]', 4000);

  if (funFactsTextarea) {
    console.log("[GenPuzzle Content] ✅ Injecting fun facts...");
    injectTextarea(funFactsTextarea, parsed.funFacts);
    console.log("[GenPuzzle Content] ✅ Fun facts injected successfully.");
  } else {
    // Debug: log all textareas currently in DOM
    const all = Array.from(document.querySelectorAll('textarea'));
    console.warn("[GenPuzzle Content] ⚠️ Fun facts textarea NOT found. Textareas in DOM:");
    all.forEach((t, i) => console.log(`  [${i}] placeholder="${t.getAttribute('placeholder')}"`));
  }

  showWaitLoader();
  finalizePasting();
}

async function ensureCustomTitleSelected() {
  const labels = Array.from(document.querySelectorAll('label'));
  const titleLabel = labels.find(l => l.textContent.trim() === 'Title');
  if (!titleLabel) return;
  
  const parent = titleLabel.parentElement;
  if (!parent) return;
  
  const trigger = parent.querySelector('button[role="combobox"]');
  if (!trigger) return;
  
  if (trigger.textContent.includes('Custom Title Per Puzzle')) {
    return;
  }
  
  console.log("[GenPuzzle Content] Clicking title dropdown trigger...");
  trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  trigger.click();
  
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"]'));
  const customOption = options.find(opt => opt.textContent.includes('Custom Title Per Puzzle'));
  
  if (customOption) {
    console.log("[GenPuzzle Content] Selecting 'Custom Title Per Puzzle' option");
    customOption.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    customOption.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    customOption.click();
    await new Promise(resolve => setTimeout(resolve, 150));
  } else {
    console.warn("[GenPuzzle Content] Custom Title Per Puzzle option not found in dropdown");
  }
}

async function finalizePasting() {
  try {
    window.hasGenPuzzlePromptRun = false;
    window.hasGenPuzzleScriptRun = false;
    window.hasGeminiExtensionRun = false;
    console.log('[GenPuzzle Content] ✅ Script locks cleared for reuse');
  } catch (e) {
    console.warn('[GenPuzzle Content] Failed to reset script locks:', e);
  }

  const clicked = await clickGeneratePuzzlesButton();
  if (!clicked) {
    console.warn('[GenPuzzle Content] ❌ Could not click Generate Puzzles button; aborting preview wait');
  } else {
    console.log('[GenPuzzle Content] ⏳ Waiting for puzzle preview to appear...');
    const previewFound = await waitForPuzzlePreview();
    if (previewFound) {
      console.log('[GenPuzzle Content] ✅ Puzzle preview detected');
    } else {
      console.warn('[GenPuzzle Content] ⚠️ Puzzle preview did not appear before timeout');
    }
  }

  if (currentRequestId) {
    chrome.runtime.sendMessage(
      {
        type: 'IMPORT_COMPLETE',
        requestId: currentRequestId,
        success: true,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[GenPuzzle Content] Failed to send IMPORT_COMPLETE:', chrome.runtime.lastError.message);
        } else {
          console.log('[GenPuzzle Content] ✅ IMPORT_COMPLETE sent for requestId:', currentRequestId);
        }
      }
    );
  } else {
    console.warn('[GenPuzzle Content] No requestId present when sending IMPORT_COMPLETE');
  }

  hideWaitLoader();
  window.dispatchEvent(new CustomEvent('EXTENSION_GENERATION_SUCCESS'));
  console.log('[GenPuzzle Content] Script locks cleared and success event dispatched.');
}

function findGeneratePuzzlesButton() {
  const buttons = Array.from(document.querySelectorAll('button'));
  const normalized = (text) => (text || '').trim().toLowerCase();

  const exact = buttons.find((btn) => {
    const text = normalized(btn.textContent);
    return text.match(/^generate\s+\d+\s+puzzles$/);
  });
  if (exact) {
    return exact;
  }

  const partial = buttons.find((btn) => {
    const text = normalized(btn.textContent);
    return text.includes('generate') && text.includes('puzzles');
  });
  if (partial) {
    return partial;
  }

  return buttons.find((btn) => normalized(btn.textContent).includes('generate')) || null;
}

function clickGeneratePuzzlesButton() {
  return new Promise((resolve) => {
    const tryClick = () => {
      const button = findGeneratePuzzlesButton();
      if (button && !button.disabled) {
        console.log('[GenPuzzle Content] ✅ Clicking Generate Puzzles button');
        button.click();
        window.hasClickedGeneratePuzzles = true;
        console.log('[GenPuzzle Content] ✅ Flag set: hasClickedGeneratePuzzles = true');
        return true;
      }
      console.warn('[GenPuzzle Content] ⚠️ Generate Puzzles button not found yet');
      return false;
    };

    if (tryClick()) {
      resolve(true);
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryClick()) {
        clearInterval(interval);
        resolve(true);
      } else if (attempts >= 6) {
        clearInterval(interval);
        resolve(false);
      }
    }, 500);
  });
}

function isVisible(element) {
  if (!element) return false;
  return !!(
    element.offsetWidth ||
    element.offsetHeight ||
    element.getClientRects().length
  );
}

function waitForPuzzlePreview(timeout = 120000) {
  const candidates = [
    'div[class*="preview"]',
    'section[class*="preview"]',
    'article[class*="preview"]',
    'div[class*="puzzle"]',
    'section[class*="puzzle"]',
    'article[class*="puzzle"]',
    'div[class*="grid"]',
    'div[class*="board"]',
    '.preview',
    '.puzzle',
    '.grid',
    '.board',
  ];

  const textPatterns = [/preview/i, /generated puzzle/i, /puzzle preview/i, /your puzzles/i, /word search/i];

  const check = () => {
    const nodes = Array.from(document.querySelectorAll(candidates.join(',')));
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const text = (node.textContent || '').trim();
      if (textPatterns.some((pattern) => pattern.test(text))) {
        console.log('[GenPuzzle Content] ✅ Puzzle preview indicator found in node:', node);
        return true;
      }
      if (node.querySelector('canvas, svg, img')) {
        console.log('[GenPuzzle Content] ✅ Puzzle preview media element detected');
        return true;
      }
    }
    return false;
  };

  return new Promise((resolve) => {
    if (check()) {
      resolve(true);
      return;
    }

    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        resolve(true);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      console.warn('[GenPuzzle Content] ⚠️ Puzzle preview did not appear within timeout');
      resolve(false);
    }, timeout);
  });
}

/**
 * Handle PASTE_FUN_FACTS: Inject fun facts into the fun facts textarea
 */
function handlePasteFunFacts(payloadText) {
  console.log("[GenPuzzle Content] Processing PASTE_FUN_FACTS...");
  console.log("[GenPuzzle Content] Payload length:", payloadText ? payloadText.length : 0);
  
  if (!payloadText || payloadText.length === 0) {
    console.warn("[GenPuzzle Content] ⚠️ No fun facts provided");
    return;
  }

  injectFunFacts(payloadText);
}

/**
 * Inject fun facts into the fun facts textarea
 */
function injectFunFacts(funFactsContent) {
  console.log("[GenPuzzle Content] Locating fun facts textarea...");
  
  // Retry mechanism to wait for textarea to be available
  let attempts = 0;
  const maxAttempts = 20; // Try for ~2 seconds (20 * 100ms)
  
  const tryInject = () => {
    attempts++;
    console.log("[GenPuzzle Content] Injection attempt #" + attempts);
    
    let funFactsTextarea = null;
    
    // Strategy 1: Exact placeholder match
    funFactsTextarea = document.querySelector('textarea[placeholder="Enter one fun fact or quote per line..."]');
    if (funFactsTextarea) {
      console.log("[GenPuzzle Content] ✅ Found via exact placeholder match");
    }
    
    // Strategy 2: Look for textarea with placeholder containing "fun fact"
    if (!funFactsTextarea) {
      funFactsTextarea = document.querySelector('textarea[placeholder*="fun fact"]');
      if (funFactsTextarea) {
        console.log("[GenPuzzle Content] ✅ Found via placeholder*='fun fact'");
      }
    }
    
    // Strategy 3: Look for textarea with placeholder containing "quote"
    if (!funFactsTextarea) {
      funFactsTextarea = document.querySelector('textarea[placeholder*="quote"]');
      if (funFactsTextarea) {
        console.log("[GenPuzzle Content] ✅ Found via placeholder*='quote'");
      }
    }
    
    // Strategy 4: Look for all textareas and check their placeholders
    if (!funFactsTextarea) {
      const allTextareas = document.querySelectorAll('textarea');
      console.log("[GenPuzzle Content] Found " + allTextareas.length + " textareas total");
      
      for (let ta of allTextareas) {
        const placeholder = (ta.getAttribute('placeholder') || '').toLowerCase();
        console.log("[GenPuzzle Content] Textarea placeholder: '" + placeholder + "'");
        
        if (placeholder.includes('fun fact') || placeholder.includes('quote')) {
          funFactsTextarea = ta;
          console.log("[GenPuzzle Content] ✅ Found via placeholder content search");
          break;
        }
      }
    }
    
    // Strategy 5: Find by class combination (h-28 is the height class for fun facts textarea)
    if (!funFactsTextarea) {
      const textareasWithHeight = document.querySelectorAll('textarea.h-28');
      if (textareasWithHeight.length > 0) {
        // The fun facts textarea is usually the second one (after Your Words)
        funFactsTextarea = textareasWithHeight[textareasWithHeight.length - 1];
        console.log("[GenPuzzle Content] ✅ Found via h-28 class");
      }
    }
    
    if (funFactsTextarea) {
      console.log("[GenPuzzle Content] ✅ Successfully located fun facts textarea on attempt #" + attempts);
      
      // Inject the fun facts
      funFactsTextarea.value = funFactsContent;
      console.log("[GenPuzzle Content] ✅ Injected " + funFactsContent.split('\n').length + " fun facts");
      
      // Trigger React state update
      funFactsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      funFactsTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      funFactsTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
      
      console.log("[GenPuzzle Content] ✅ Fun facts injected successfully");
      return true;
    } else {
      if (attempts < maxAttempts) {
        console.log("[GenPuzzle Content] ⏳ Textarea not found yet, retrying in 100ms...");
        setTimeout(tryInject, 100);
      } else {
        console.warn("[GenPuzzle Content] ⚠️ Could not find the fun facts textarea after " + attempts + " attempts");
        console.log("[GenPuzzle Content] Debugging: Checking for Design tab...");
        
        // Additional debugging: check if page structure is as expected
        const mainSidebar = document.querySelector('.w-96');
        if (mainSidebar) {
          console.log("[GenPuzzle Content] ✅ Found main sidebar");
        } else {
          console.log("[GenPuzzle Content] ❌ Main sidebar not found - page may not be fully loaded");
        }
      }
      return false;
    }
  };
  
  tryInject();
}
