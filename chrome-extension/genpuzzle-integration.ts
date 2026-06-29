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
 */
export const EXTENSION_ID = "YOUR_EXTENSION_ID_HERE";

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
    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
      reject(
        new Error(
          "Extension ID not set. Please update EXTENSION_ID with your actual extension ID from chrome://extensions/"
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
            console.error(
              "[Integration] Extension error:",
              chrome.runtime.lastError
            );
            reject(chrome.runtime.lastError);
          } else {
            console.log("[Integration] Extension automation started:", response);
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error("[Integration] Failed to send message to extension:", error);
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
    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
      reject(
        new Error(
          "Extension ID not set. Please update EXTENSION_ID with your actual extension ID"
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
 * Listen for word generation responses from the extension
 * Call this once when your component mounts
 * 
 * @param callback - Function to call when words are generated
 * @returns Cleanup function to remove the listener
 */
export function onWordsGenerated(
  callback: (data: WordsResponse) => void
): () => void {
  const messageListener = (message: WordsResponse) => {
    if (
      message.type === "RESPONSE_RECEIVED" &&
      (message.action === "GENERATE_WORDS" ||
        message.action === "GENERATE_CONTENT") &&
      message.dataType === "text"
    ) {
      console.log("[Integration] Words received:", message);
      callback(message);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
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
  const messageListener = (message: any) => {
    if (
      message.type === "RESPONSE_RECEIVED" &&
      message.action === "GENERATE_IMAGE" &&
      message.dataType === "image"
    ) {
      console.log("[Integration] Image received (size:", message.imageData.length, "bytes)");
      callback(message);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
  };
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

/**
 * Example usage in a React component:
 * 
 * ```tsx
 * import { useWordGeneration } from '@/lib/extension-integration';
 * 
 * export function WordGeneratorComponent() {
 *   const { generateWords, isLoading, data, error } = useWordGeneration();
 * 
 *   const handleClick = () => {
 *     generateWords({
 *       puzzlesCount: 5,
 *       maxLength: 8,
 *       charCase: "lowercase",
 *       ageLevel: "8-10",
 *       language: "English",
 *       themeTitle: "Animals\nFruits\nColors"
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleClick} disabled={isLoading}>
 *         {isLoading ? "Generating..." : "Generate Words"}
 *       </button>
 *       {error && <div style={{color: 'red'}}>{error}</div>}
 *       {data && (
 *         <div>
 *           {data.words?.map((item, idx) => (
 *             <div key={idx}>
 *               <strong>{item.theme}</strong>: {item.words.join(", ")}
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
