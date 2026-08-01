/**
 * GenPuzzle Image Generator - Background Service Worker (Manifest V3)
 * 
 * Responsibilities:
 * - Listen for external messages from GenPuzzle website
 * - Queue prompts in storage by tab ID
 * - Open tabs and relay responses
 */

const activeRequests = new Map();
const importCompletionRequests = new Map();
const QUEUED_PROMPT_PREFIX = 'queuedPrompt_';
const PENDING_REQUEST_PREFIX = 'pendingRequest_';
const ORIGINAL_PREFIX = 'originalGenPuzzle_';
let isExtensionCurrentlyProcessing = false;

// In-memory cache (fast access) — persisted to chrome.storage.local for service worker restarts
let originalGenPuzzleTabId = null;
let originalGenPuzzleWindowId = null;
let originalGenPuzzleRequestId = null;

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  // Handle PING to verify extension availability
  if (request.action === 'PING') {
    console.log('[Background] ✅ Received PING from GenPuzzle website');
    sendResponse({ success: true, action: 'PONG' });
    return true;
  }

  // New: capture origin tab/window for returning results when GenPuzzle initiates
  if (request.action === 'START_AI_GENERATION') {
    const reqId = request.requestId || `req_${Date.now()}`;
    // Capture sender tab/window
    const tabId = sender?.tab?.id;
    const windowId = sender?.tab?.windowId;

    if (typeof tabId === 'number') {
      originalGenPuzzleTabId = tabId;
      originalGenPuzzleWindowId = windowId;
      originalGenPuzzleRequestId = reqId;

      const payload = { tabId, windowId, requestId: reqId, savedAt: Date.now() };
      chrome.storage.local.set({ [`${ORIGINAL_PREFIX}${reqId}`]: payload }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] ⚠️ Failed to persist original tab info:', chrome.runtime.lastError.message);
        } else {
          console.log('[Background] ✅ Stored original GenPuzzle tab info for requestId:', reqId, 'tab:', tabId);
        }
      });

      sendResponse({ success: true, requestId: reqId });
    } else {
      sendResponse({ success: false, error: 'Unable to capture origin tab ID' });
    }

    return true;
  }

  if (request.action === 'QUEUE_PROMPT') {
    handleQueuePrompt(request, sender, sendResponse);
  } else {
    handleGenerateRequest(request, sender, sendResponse);
  }

  return true;
});

function saveOriginalTabInfo(requestId, tabId, windowId, callback) {
  const key = `${ORIGINAL_PREFIX}${requestId}`;
  const payload = { tabId, windowId, requestId, savedAt: Date.now() };
  chrome.storage.local.set({ [key]: payload }, () => callback && callback(chrome.runtime.lastError));
}

function getOriginalTabInfo(requestId, callback) {
  const key = `${ORIGINAL_PREFIX}${requestId}`;
  chrome.storage.local.get(key, (result) => {
    const info = result?.[key] || null;
    callback(info);
  });
}

function removeOriginalTabInfo(requestId, callback) {
  const key = `${ORIGINAL_PREFIX}${requestId}`;
  chrome.storage.local.remove(key, () => callback && callback(chrome.runtime.lastError));
}

function saveQueuedPrompt(tabId, queuedPrompt, callback) {
  chrome.storage.local.set({ [`${QUEUED_PROMPT_PREFIX}${tabId}`]: queuedPrompt }, callback);
}

function removeQueuedPrompt(tabId, callback) {
  chrome.storage.local.remove(`${QUEUED_PROMPT_PREFIX}${tabId}`, callback);
}

function getQueuedPrompt(tabId, callback) {
  chrome.storage.local.get(`${QUEUED_PROMPT_PREFIX}${tabId}`, (result) => {
    callback(result?.[`${QUEUED_PROMPT_PREFIX}${tabId}`] || null);
  });
}

function savePendingRequest(tabId, requestMetadata, callback) {
  chrome.storage.local.set({ [`${PENDING_REQUEST_PREFIX}${tabId}`]: requestMetadata }, callback);
}

function getPendingRequest(tabId, callback) {
  chrome.storage.local.get(`${PENDING_REQUEST_PREFIX}${tabId}`, (result) => {
    callback(result?.[`${PENDING_REQUEST_PREFIX}${tabId}`] || null);
  });
}

function removePendingRequest(tabId, callback) {
  chrome.storage.local.remove(`${PENDING_REQUEST_PREFIX}${tabId}`, callback);
}

function cleanupTabData(tabId) {
  activeRequests.delete(tabId);
  removeQueuedPrompt(tabId, () => {});
  removePendingRequest(tabId, () => {});
}

function handleQueuePrompt(request, sender, sendResponse) {
  const { prompt, provider = 'gemini', requestId } = request;

  console.log('[Background] ⏸️ QUEUE_PROMPT received from GenPuzzle');
  console.log('[Background] Provider:', provider);
  console.log('[Background] Prompt length:', prompt ? prompt.length : 'N/A');

  if (!prompt) {
    console.error('[Background] ❌ ABORT: Missing prompt');
    sendResponse({ success: false, error: 'Missing prompt' });
    return;
  }

  const providerUrls = {
    gemini: 'https://gemini.google.com/app',
    flux: 'https://flux-1-fill.replicate.com/',
    replicate: 'https://replicate.com/',
  };

  const aiUrl = providerUrls[provider] || providerUrls.gemini;

  console.log('[Background] Opening tab with URL:', aiUrl);

  chrome.tabs.create({ url: aiUrl, active: true }, (tab) => {
    if (!tab || typeof tab.id !== 'number') {
      console.error('[Background] ❌ Failed to create tab');
      sendResponse({ success: false, error: 'Failed to create tab' });
      return;
    }

    const tabId = tab.id;
    const queuedPrompt = {
      prompt,
      provider,
      requestId: requestId || `req_${Date.now()}`,
      senderTabId: sender?.tab?.id,
      createdAt: Date.now(),
    };

    saveQueuedPrompt(tabId, queuedPrompt, () => {
      if (chrome.runtime.lastError) {
        console.error('[Background] ❌ Failed to save queued prompt:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      const pendingRequest = {
        action: 'GENERATE_WORDS',
        prompt,
        provider,
        requestId: queuedPrompt.requestId,
        senderTabId: sender?.tab?.id,
        createdAt: queuedPrompt.createdAt,
      };

      // Persist original tab info for this request as a fallback
      if (typeof queuedPrompt.senderTabId === 'number') {
        try {
          saveOriginalTabInfo(queuedPrompt.requestId, queuedPrompt.senderTabId, sender?.tab?.windowId, () => {});
        } catch (e) {
          console.warn('[Background] ⚠️ Could not persist original tab info in handleQueuePrompt:', e);
        }
      }

      activeRequests.set(tabId, pendingRequest);
      isExtensionCurrentlyProcessing = true;
      console.log('[Background] Session processing lock set to busy.');
      savePendingRequest(tabId, pendingRequest, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] ⚠️ Failed to persist pending request:', chrome.runtime.lastError.message);
        }

        console.log('[Background] ✅ Queued prompt stored in chrome.storage.local for tab:', tabId);
        sendResponse({ success: true, tabId, requestId: queuedPrompt.requestId });
      });
    });

    setTimeout(() => cleanupTabData(tabId), 10 * 60 * 1000);
  });
}

function handleGenerateRequest(request, sender, sendResponse) {
  let action = request.action || 'GENERATE_CONTENT';
  let prompt = request.prompt;
  let aiUrl = request.aiUrl;
  let provider = request.provider || 'gemini';
  let requestId = request.requestId || `req_${Date.now()}`;

  if (!prompt) {
    sendResponse({ success: false, error: 'Missing prompt' });
    return;
  }

  if (!aiUrl && provider) {
    const providerUrls = {
      gemini: 'https://gemini.google.com/app',
      flux: 'https://flux-1-fill.replicate.com/',
      replicate: 'https://replicate.com/',
    };
    aiUrl = providerUrls[provider] || 'https://gemini.google.com/app';
  }

  if (!aiUrl) {
    sendResponse({ success: false, error: 'Missing aiUrl or invalid provider' });
    return;
  }

  chrome.tabs.create({ url: aiUrl, active: true }, (tab) => {
    if (!tab || typeof tab.id !== 'number') {
      sendResponse({ success: false, error: 'Failed to create tab' });
      return;
    }

    activeRequests.set(tab.id, {
      action,
      prompt,
      aiUrl,
      provider,
      requestId,
      senderTabId: sender?.tab?.id,
      createdAt: Date.now(),
    });
    // Persist original tab info for this request as a fallback
    if (typeof sender?.tab?.id === 'number') {
      try {
        saveOriginalTabInfo(requestId, sender.tab.id, sender.tab.windowId, () => {});
      } catch (e) {
        console.warn('[Background] ⚠️ Could not persist original tab info in handleGenerateRequest:', e);
      }
    }
    isExtensionCurrentlyProcessing = true;
    console.log('[Background] Session processing lock set to busy.');

    sendResponse({
      success: true,
      message: 'Content generation started',
      action,
      tabId: tab.id,
      requestId,
    });

    setTimeout(() => {
      activeRequests.delete(tab.id);
    }, 10 * 60 * 1000);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_QUEUED_PROMPT') {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== 'number') {
      sendResponse({ success: false, error: 'Unable to determine tab ID' });
      return;
    }

    getQueuedPrompt(tabId, (queuedData) => {
      if (queuedData) {
        removeQueuedPrompt(tabId, () => {});
        sendResponse({ success: true, data: queuedData });
      } else {
        sendResponse({ success: false, error: 'No queued prompt' });
      }
    });

    return true;
  }

  if (request.type === 'IMPORT_COMPLETE') {
    const { requestId, success } = request;
    const originalTabId = importCompletionRequests.get(requestId);
    if (typeof originalTabId === 'number') {
      console.log('[Background] ✅ Received IMPORT_COMPLETE for requestId:', requestId, 'forwarding to Gemini tab:', originalTabId);
      chrome.tabs.sendMessage(originalTabId, { type: 'IMPORT_COMPLETE', success: success === true }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] ⚠️ Failed to forward IMPORT_COMPLETE to Gemini tab:', chrome.runtime.lastError.message);
        } else {
          console.log('[Background] ✅ IMPORT_COMPLETE forwarded successfully');
        }
      });
      importCompletionRequests.delete(requestId);
      sendResponse({ success: true });
    } else {
      console.warn('[Background] ⚠️ IMPORT_COMPLETE received but original Gemini tab mapping not found for requestId:', requestId);
      sendResponse({ success: false, error: 'No original Gemini tab mapping' });
    }
    return true;
  }

  if (request.type === 'RESPONSE_GENERATED') {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== 'number') {
      sendResponse({ success: false, error: 'Unable to determine tab ID' });
      return;
    }

    let requestMetadata = activeRequests.get(tabId);

    const finalizeResponse = (metadata) => {
      if (!metadata) {
        isExtensionCurrentlyProcessing = false;
        console.log('[Background] Session processing lock reset to idle (no matching metadata).');
        sendResponse({ success: false, error: 'No matching request' });
        return;
      }

      const { dataType, imageData, textData, funFacts, title, rawText, error } = request;
      const { senderTabId, action, requestId } = metadata;

      if (error) {
        isExtensionCurrentlyProcessing = false;
        console.log('[Background] Session processing lock reset to idle due to error.');
        sendResponse({ success: false, error });
        cleanupTabData(tabId);
        return;
      }

      console.log('[Background] SPEC 2: Initiating GenPuzzle tab communication...');

      const deliverToTab = (targetTabId, targetWindowId) => {
        if (typeof targetTabId !== 'number') {
          console.warn('[Background] ❌ Invalid targetTabId for delivery');
          return;
        }

        chrome.tabs.update(targetTabId, { active: true }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Background] Tab focus warning:', chrome.runtime.lastError.message);
          }
        });

        if (typeof targetWindowId === 'number') {
          chrome.windows.update(targetWindowId, { focused: true }, () => {
            if (chrome.runtime.lastError) {
              console.warn('[Background] Window focus warning:', chrome.runtime.lastError.message);
            } else {
              console.log('[Background] ✅ GenPuzzle tab brought to foreground');
            }
          });
        }

        setTimeout(() => {
          console.log('[Background] Injecting genpuzzle-content.js into target tab...');
          chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['genpuzzle-content.js'],
          }).then(() => {
            console.log('[Background] ✅ Content script injected successfully');
            console.log('[Background] Transmitting PASTE_DATA with filtered content...');
            chrome.tabs.sendMessage(targetTabId, {
              type: 'PASTE_DATA',
              requestId,
              text: request.textData,
              funFacts: request.funFacts,
              title: request.title,
              rawText: request.rawText,
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn('[Background] ⚠️ PASTE_DATA transmission issue:', chrome.runtime.lastError.message);
              } else {
                console.log('[Background] ✅ PASTE_DATA transmitted successfully with filtered content');
              }
            });

            // Backup: notify React app via window.postMessage in case content script listener missed it
            chrome.scripting.executeScript({
              target: { tabId: targetTabId },
              func: (payload) => {
                if (payload.wordsText) {
                  document.dispatchEvent(new CustomEvent('genpuzzle-paste-data', { detail: { text: payload.wordsText } }));
                }
                if (payload.funFactsText) {
                  document.dispatchEvent(new CustomEvent('genpuzzle-paste-fun-facts', { detail: { text: payload.funFactsText } }));
                }
                window.postMessage({
                  type: 'GENPUZZLE_RESPONSE',
                  data: {
                    action: payload.action,
                    dataType: 'text',
                    requestId: payload.requestId,
                    textData: payload.wordsText,
                    funFacts: payload.funFactsText,
                    title: payload.title,
                    rawText: payload.rawText,
                  },
                }, '*');
              },
              args: [{
                action: action || 'GENERATE_WORDS',
                requestId,
                wordsText: request.textData || '',
                funFactsText: request.funFacts || '',
                title: request.title || '',
                rawText: request.rawText || '',
              }],
            }).catch((err) => {
              console.warn('[Background] postMessage backup failed:', err);
            });

            // Send fun facts to a separate message if they exist
            if (request.funFacts && request.funFacts.length > 0) {
              setTimeout(() => {
                chrome.tabs.sendMessage(targetTabId, {
                  type: 'PASTE_FUN_FACTS',
                  requestId,
                  text: request.funFacts,
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn('[Background] ⚠️ PASTE_FUN_FACTS transmission issue:', chrome.runtime.lastError.message);
                  } else {
                    console.log('[Background] ✅ PASTE_FUN_FACTS transmitted successfully');
                  }
                });
              }, 100);
            }
          }).catch((err) => {
            console.error('[Background] Script execution halted:', err);
          });
        }, 400);
      };

      // Try persisted original tab info (saved per requestId), then fall back to in-memory capture, then senderTabId, then localhost search
      const attemptDelivery = (info) => {
        if (info && typeof info.tabId === 'number') {
          console.log('[Background] ✅ Using persisted original tab info for requestId:', info.requestId, 'tab:', info.tabId);
          deliverToTab(info.tabId, info.windowId);
          removeOriginalTabInfo(info.requestId, () => {});
          return;
        }

        if (typeof originalGenPuzzleTabId === 'number' && originalGenPuzzleRequestId === requestId) {
          console.log('[Background] ✅ Using in-memory original tab info for requestId:', originalGenPuzzleRequestId, 'tab:', originalGenPuzzleTabId);
          deliverToTab(originalGenPuzzleTabId, originalGenPuzzleWindowId);
          removeOriginalTabInfo(originalGenPuzzleRequestId, () => {});
          return;
        }

        if (typeof senderTabId === 'number') {
          console.log('[Background] ✅ Falling back to senderTabId for delivery:', senderTabId);
          deliverToTab(senderTabId, null);
          return;
        }

        // Last resort: search for localhost/127.0.0.1 tabs (older behavior)
        chrome.tabs.query({ url: ['*://localhost:*/*', '*://127.0.0.1:*/*', 'https://*.puzzlertool.com/*'] }, (tabs) => {
          if (tabs && tabs.length > 0) {
            const targetTab = tabs[0];
            console.log('[Background] ✅ Found GenPuzzle tab via localhost search:', targetTab.id, 'in window:', targetTab.windowId);
            deliverToTab(targetTab.id, targetTab.windowId);
          } else {
            console.warn('[Background] ⚠️ GenPuzzle tab not found in current windows (all fallbacks failed)');
          }
        });
      };

      // Try to load persisted info for this requestId first
      getOriginalTabInfo(requestId, (stored) => {
        attemptDelivery(stored);
      });

      importCompletionRequests.set(requestId, tabId);
      cleanupTabData(tabId);
      isExtensionCurrentlyProcessing = false;
      console.log('[Background] Session processing lock completely reset to idle.');
      sendResponse({ success: true });
    };

    if (requestMetadata) {
      finalizeResponse(requestMetadata);
    } else {
      getPendingRequest(tabId, (pending) => {
        if (pending) {
          requestMetadata = pending;
        }
        finalizeResponse(requestMetadata);
      });
    }

    return true;
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cleanupTabData(tabId);
});
