/**
 * GenPuzzle Chrome Extension Integration
 * Properly typed integration for word/image generation with the extension
 * 
 * Usage:
 * 1. Get your extension ID from chrome://extensions/
 * 2. Import and use the integration functions in your React components
 */

import React from 'react';

/**
 * Get the extension ID from chrome://extensions
 * Replace with your actual extension ID after installation
 * 
 * HOW TO GET YOUR EXTENSION ID:
 * 1. Open chrome://extensions/ in your browser
 * 2. Enable "Developer mode" (toggle in top right)
 * 3. Find your GenPuzzle Extension in the list
 * 4. Copy the ID (32-character alphanumeric string) from below the extension name
 * 5. Replace the placeholder below with your actual ID
 */
export const EXTENSION_ID = "pkokhbpdkolfhcbbghmopfcfbiamioie";

/**
 * Interface for extension message response
 */
interface ExtensionResponse {
  success: boolean;
  action?: string;
  tabId?: number;
  requestId?: string;
  error?: string;
}

/**
 * Interface for word generation response
 */
interface WordsResponse {
  type: "RESPONSE_RECEIVED";
  action: string;
  requestId: string;
  dataType: "text";
  words?: Array<{ theme: string; words: string[] }>;
  textData?: Array<{ theme: string; words: string[] }>;
  timestamp: number;
  success?: boolean;
}

/**
 * Send a word generation request to the extension
 * 
 * @param options - Configuration for word generation
 * @returns Promise that resolves with the response
 */
export function generateWords(options: {
  puzzlesCount: number;
  maxLength: number;
  charCase: "uppercase" | "lowercase" | "mixed";
  ageLevel: string;
  language: string;
  themeTitle: string;
}): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window object not available'));
      return;
    }

    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome extension API not available. Make sure the extension is installed.'));
      return;
    }

    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
      reject(
        new Error(
          `Extension ID not configured. Please:\n` +
          `1. Open chrome://extensions/ in your browser\n` +
          `2. Enable "Developer mode" (top right)\n` +
          `3. Find your GenPuzzle Extension and copy its ID\n` +
          `4. Update EXTENSION_ID in src/lib/genpuzzle-extension-integration.ts\n` +
          `5. Reload the page`
        )
      );
      return;
    }

    const dynamicPrompt = `Generate ${options.puzzlesCount} word lists. Each word must not exceed ${options.maxLength} letters in ${options.charCase} case. Unique no duplicated words, target audience: ${options.ageLevel}, language: ${options.language}. Make sure to add space between words when we have 2 words based. Format:\n${options.themeTitle}\nword, word, word...`;

    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: "GENERATE_WORDS",
          provider: "gemini",
          prompt: dynamicPrompt,
          requestId: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send an image generation request to the extension
 * 
 * @param prompt - The image generation prompt
 * @param provider - AI provider (default: "gemini")
 * @returns Promise that resolves with the response
 */
export function generateImage(
  prompt: string,
  provider: "gemini" | "flux" | "replicate" = "gemini"
): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window object not available'));
      return;
    }

    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome extension API not available. Make sure the extension is installed.'));
      return;
    }

    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
      reject(
        new Error(
          `Extension ID not configured. Please:\n` +
          `1. Open chrome://extensions/ in your browser\n` +
          `2. Enable "Developer mode" (top right)\n` +
          `3. Find your GenPuzzle Extension and copy its ID\n` +
          `4. Update EXTENSION_ID in src/lib/genpuzzle-extension-integration.ts\n` +
          `5. Reload the page`
        )
      );
      return;
    }

    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: "GENERATE_IMAGE",
          provider,
          prompt,
          requestId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Queue a prompt in the extension to be injected when the AI provider tab opens
 * This method ensures the prompt is safely stored before opening the tab
 * 
 * @param options - Configuration for prompt queuing
 * @returns Promise that resolves when prompt is successfully queued
 */
export function queuePrompt(options: {
  prompt: string;
  provider?: "gemini" | "flux" | "replicate";
}): Promise<{ success: boolean; requestId: string; tabId?: number; error?: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window object not available'));
      return;
    }

    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome extension API not available. Make sure the extension is installed.'));
      return;
    }

    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
      reject(
        new Error(
          `Extension ID not configured. Please:\n` +
          `1. Open chrome://extensions/ in your browser\n` +
          `2. Enable "Developer mode" (top right)\n` +
          `3. Find your GenPuzzle Extension and copy its ID\n` +
          `4. Update EXTENSION_ID in src/lib/genpuzzle-extension-integration.ts\n` +
          `5. Reload the page`
        )
      );
      return;
    }

    try {
      const requestId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: "QUEUE_PROMPT",
          provider: options.provider || "gemini",
          prompt: options.prompt,
          requestId,
        },
        (response: ExtensionResponse) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response.success) {
            resolve({
              success: true,
              requestId: response.requestId || requestId,
              tabId: response.tabId,
            });
          } else {
            reject(new Error(response.error || 'Failed to queue prompt'));
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check whether the GenPuzzle extension is available/responding.
 * Attempts a lightweight runtime.sendMessage ping and resolves true on success.
 */
export function isExtensionAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) return resolve(false);

    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: 'PING' },
        (response: any) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Listen for word generation responses from the extension
 * Supports both chrome.runtime.onMessage and window.postMessage fallback
 * Call this once when your component mounts
 * 
 * @param callback - Function to call when words are generated
 * @returns Cleanup function to remove the listener
 */
export function onWordsGenerated(
  callback: (data: WordsResponse) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const hasChromeAPI = typeof chrome !== 'undefined' && chrome?.runtime?.onMessage;

  const listeners: Array<() => void> = [];

  if (hasChromeAPI) {
    const messageListener = (message: any) => {
      if (
        message?.type === "RESPONSE_RECEIVED" &&
        (message?.action === "GENERATE_WORDS" || message?.action === "GENERATE_CONTENT") &&
        message?.dataType === "text"
      ) {
        callback(message as WordsResponse);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    listeners.push(() => {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    });
  }

  // Also listen for window.postMessage fallback from extension
  // This handles cases where chrome.tabs.sendMessage fails
  const windowMessageListener = (event: MessageEvent) => {
    if (event.source !== window) return;

    const message = event.data;
    
    // Handle GENPUZZLE_RESPONSE from fallback postMessage
    if (message?.type === "GENPUZZLE_RESPONSE" && message?.data) {
      const data = message.data;
      if (
        (data?.action === "GENERATE_WORDS" || data?.action === "GENERATE_CONTENT") &&
        data?.dataType === "text"
      ) {
        callback({
          type: "RESPONSE_RECEIVED",
          action: data.action,
          requestId: data.requestId,
          dataType: "text",
          words: data.words || data.textData,
          textData: data.textData || data.words,
          timestamp: Date.now(),
          success: true,
        } as WordsResponse);
      }
    }
    // Also handle direct RESPONSE_RECEIVED messages
    else if (
      message?.type === "RESPONSE_RECEIVED" &&
      (message?.action === "GENERATE_WORDS" || message?.action === "GENERATE_CONTENT") &&
      message?.dataType === "text"
    ) {
      callback(message as WordsResponse);
    }
  };

  window.addEventListener("message", windowMessageListener);
  listeners.push(() => {
    window.removeEventListener("message", windowMessageListener);
  });

  return () => {
    listeners.forEach(cleanup => cleanup());
  };
}

/**
 * Listen for pasted data from the extension (formatted text to inject)
 * Used when AI-generated words are ready to be pasted into the word list
 * 
 * @param callback - Function to call when paste data is received (receives formatted text)
 * @returns Cleanup function to remove the listener
 */
export function onPasteData(
  callback: (text: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const hasChromeAPI = typeof chrome !== 'undefined' && chrome?.runtime?.onMessage;

  const listeners: Array<() => void> = [];

  if (hasChromeAPI) {
    const messageListener = (message: any) => {
      if (message?.type === "PASTE_DATA" && message?.text) {
        callback(message.text);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    listeners.push(() => {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    });
  }

  // Also listen for custom event dispatch (for React integration)
  const customEventListener = (event: CustomEvent) => {
    if (event.detail?.text) {
      callback(event.detail.text);
    }
  };

  document.addEventListener("genpuzzle-paste-data", customEventListener as EventListener);
  listeners.push(() => {
    document.removeEventListener("genpuzzle-paste-data", customEventListener as EventListener);
  });

  return () => {
    listeners.forEach(cleanup => cleanup());
  };
}

/**
 * Listen for fun facts paste from the extension
 * 
 * @param callback - Function to call when fun facts are pasted
 * @returns Cleanup function to remove the listener
 */
export function onPasteFunFacts(
  callback: (text: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const hasChromeAPI = typeof chrome !== 'undefined' && chrome?.runtime?.onMessage;

  const listeners: Array<() => void> = [];

  if (hasChromeAPI) {
    const messageListener = (message: any) => {
      if (message?.type === "PASTE_FUN_FACTS" && message?.text) {
        callback(message.text);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    listeners.push(() => {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    });
  }

  // Also listen for custom event dispatch (for React integration)
  const customEventListener = (event: CustomEvent) => {
    if (event.detail?.text) {
      callback(event.detail.text);
    }
  };

  document.addEventListener("genpuzzle-paste-fun-facts", customEventListener as EventListener);
  listeners.push(() => {
    document.removeEventListener("genpuzzle-paste-fun-facts", customEventListener as EventListener);
  });

  return () => {
    listeners.forEach(cleanup => cleanup());
  };
}

/**
 * Listen for image generation responses from the extension
 * 
 * @param callback - Function to call when image is generated
 * @returns Cleanup function to remove the listener
 */
export function onImageGenerated(
  callback: (data: {
    type: "RESPONSE_RECEIVED";
    action: string;
    imageData: string;
    dataType: "image";
    requestId: string;
  }) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const hasChromeAPI = typeof chrome !== 'undefined' && chrome?.runtime?.onMessage;

  if (hasChromeAPI) {
    const messageListener = (message: any) => {
      if (
        message?.type === "RESPONSE_RECEIVED" &&
        message?.action === "GENERATE_IMAGE" &&
        message?.dataType === "image"
      ) {
        callback(message);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  } else {
    const windowMessageListener = (event: MessageEvent) => {
      if (event.source !== window) return;

      const message = event.data;
      if (
        message?.type === "RESPONSE_RECEIVED" &&
        message?.action === "GENERATE_IMAGE" &&
        message?.dataType === "image"
      ) {
        callback(message);
      }
    };

    window.addEventListener("message", windowMessageListener);

    return () => {
      window.removeEventListener("message", windowMessageListener);
    };
  }
}

/**
 * React Hook: Use this in your components for word generation
 * 
 * @example
 * const { generateWords, isLoading, data, error } = useWordGeneration();
 * 
 * // In your component:
 * return (
 *   <>
 *     <button onClick={() => generateWords({...options})}>Generate</button>
 *     {isLoading && <p>Generating...</p>}
 *     {data && <p>Words: {JSON.stringify(data)}</p>}
 *     {error && <p style={{color: 'red'}}>{error}</p>}
 *   </>
 * );
 */
export function useWordGeneration() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [data, setData] = React.useState<WordsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(
    null
  );

  // Setup listener for responses
  React.useEffect(() => {
    if (!currentRequestId) return; // Don't set up listener if no request ID
    
    const cleanup = onWordsGenerated((response) => {
      if (response.requestId === currentRequestId) {
        setData(response);
        setIsLoading(false);
      }
    });

    return cleanup;
  }, [currentRequestId]);

  const handleGenerateWords = React.useCallback(
    async (options: {
      puzzlesCount: number;
      maxLength: number;
      charCase: "uppercase" | "lowercase" | "mixed";
      ageLevel: string;
      language: string;
      themeTitle: string;
    }) => {
      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await generateWords(options);
        if (response.success && response.requestId) {
          setCurrentRequestId(response.requestId);
        } else {
          setError(response.error || "Failed to start generation");
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setIsLoading(false);
      }
    },
    []
  );

  return {
    generateWords: handleGenerateWords,
    isLoading,
    data,
    error,
  };
}

/**
 * React Hook: Use this in your components for image generation
 */
export function useImageGeneration() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [imageData, setImageData] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(
    null
  );

  // Setup listener for responses
  React.useEffect(() => {
    if (!currentRequestId) return; // Don't set up listener if no request ID
    
    const cleanup = onImageGenerated((response) => {
      if (response.requestId === currentRequestId) {
        setImageData(response.imageData);
        setIsLoading(false);
      }
    });

    return cleanup;
  }, [currentRequestId]);

  const handleGenerateImage = React.useCallback(
    async (
      prompt: string,
      provider: "gemini" | "flux" | "replicate" = "gemini"
    ) => {
      setIsLoading(true);
      setError(null);
      setImageData(null);

      try {
        const response = await generateImage(prompt, provider);
        if (response.success && response.requestId) {
          setCurrentRequestId(response.requestId);
        } else {
          setError(response.error || "Failed to start generation");
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setIsLoading(false);
      }
    },
    []
  );

  return {
    generateImage: handleGenerateImage,
    isLoading,
    imageData,
    error,
  };
}
