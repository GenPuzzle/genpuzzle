/**
 * Example integration for GenPuzzle Next.js app
 * Shows how to send prompts to the Chrome Extension and listen for generated images
 * 
 * Place this in your GenPuzzle codebase and adapt as needed
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage communication with GenPuzzle Image Generator Extension
 */
export function useImageGenerator() {
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(new Map());
  const [generatedImages, setGeneratedImages] = useState(new Map());
  const [errors, setErrors] = useState(new Map());

  // Check if extension is available on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.chrome?.runtime?.sendMessage) {
      setIsExtensionAvailable(true);
    }

    // Listen for image responses from extension
    if (typeof window !== 'undefined' && window.chrome?.runtime?.onMessage) {
      const listener = (message, sender, sendResponse) => {
        if (message.type === 'IMAGE_RESPONSE') {
          const { requestId, imageData, error } = message;

          if (error) {
            setErrors((prev) => new Map(prev).set(requestId, error));
            setGeneratingImages((prev) => {
              const updated = new Map(prev);
              updated.delete(requestId);
              return updated;
            });
          } else {
            setGeneratedImages((prev) =>
              new Map(prev).set(requestId, imageData)
            );
            setGeneratingImages((prev) => {
              const updated = new Map(prev);
              updated.delete(requestId);
              return updated;
            });
          }

          sendResponse({ received: true });
        }
      };

      window.chrome.runtime.onMessage.addListener(listener);

      return () => {
        if (window.chrome?.runtime?.onMessage?.removeListener) {
          window.chrome.runtime.onMessage.removeListener(listener);
        }
      };
    }
  }, []);

  /**
   * Send a prompt to the extension for image generation
   * @param prompt - The image generation prompt
   * @param aiUrl - The URL of the AI provider (e.g., "https://gemini.google.com/app")
   * @returns requestId - Unique ID to track this request
   */
  const generateImage = useCallback(
    (prompt, aiUrl = 'https://gemini.google.com/app') => {
      if (!isExtensionAvailable) {
        console.error('GenPuzzle Image Generator extension is not available');
        return null;
      }

      const requestId = `puzzle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mark as generating
      setGeneratingImages((prev) => new Map(prev).set(requestId, true));

      try {
        window.chrome.runtime.sendMessage(
          {
            prompt,
            aiUrl,
            requestId,
          },
          (response) => {
            if (window.chrome.runtime.lastError) {
              console.error(
                'Failed to send request to extension:',
                window.chrome.runtime.lastError
              );
              setErrors((prev) =>
                new Map(prev).set(
                  requestId,
                  'Failed to communicate with extension'
                )
              );
              setGeneratingImages((prev) => {
                const updated = new Map(prev);
                updated.delete(requestId);
                return updated;
              });
            } else {
              console.log('Image generation started:', response);
            }
          }
        );
      } catch (error) {
        console.error('Error sending request to extension:', error);
        setErrors((prev) =>
          new Map(prev).set(requestId, error.message)
        );
        setGeneratingImages((prev) => {
          const updated = new Map(prev);
          updated.delete(requestId);
          return updated;
        });
      }

      return requestId;
    },
    [isExtensionAvailable]
  );

  /**
   * Get the status of an image generation request
   */
  const getRequestStatus = useCallback(
    (requestId) => {
      if (generatingImages.has(requestId)) {
        return 'generating';
      } else if (generatedImages.has(requestId)) {
        return 'completed';
      } else if (errors.has(requestId)) {
        return 'error';
      } else {
        return 'unknown';
      }
    },
    [generatingImages, generatedImages, errors]
  );

  /**
   * Get the generated image data URL
   */
  const getGeneratedImage = useCallback(
    (requestId) => {
      return generatedImages.get(requestId) || null;
    },
    [generatedImages]
  );

  /**
   * Get the error message for a request
   */
  const getError = useCallback(
    (requestId) => {
      return errors.get(requestId) || null;
    },
    [errors]
  );

  /**
   * Clear a request from tracking
   */
  const clearRequest = useCallback((requestId) => {
    setGeneratingImages((prev) => {
      const updated = new Map(prev);
      updated.delete(requestId);
      return updated;
    });
    setGeneratedImages((prev) => {
      const updated = new Map(prev);
      updated.delete(requestId);
      return updated;
    });
    setErrors((prev) => {
      const updated = new Map(prev);
      updated.delete(requestId);
      return updated;
    });
  }, []);

  return {
    isExtensionAvailable,
    generateImage,
    getRequestStatus,
    getGeneratedImage,
    getError,
    clearRequest,
  };
}

/**
 * Example React component using the hook
 */
export function ImageGeneratorComponent() {
  const {
    isExtensionAvailable,
    generateImage,
    getRequestStatus,
    getGeneratedImage,
    getError,
  } = useImageGenerator();

  const [prompt, setPrompt] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState(null);

  const handleGenerate = () => {
    const id = generateImage(prompt);
    if (id) {
      setRequestId(id);
      setStatus('generating');
    }
  };

  useEffect(() => {
    if (!requestId) return;

    const interval = setInterval(() => {
      const currentStatus = getRequestStatus(requestId);
      setStatus(currentStatus);
    }, 500);

    return () => clearInterval(interval);
  }, [requestId, getRequestStatus]);

  if (!isExtensionAvailable) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-700">
          GenPuzzle Image Generator extension is not installed or not accessible.
          <br />
          Please install it from the Chrome Extension store or load it locally for
          development.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Generate Image</h2>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your image description..."
        className="w-full p-3 border rounded mb-4 min-h-32"
      />

      <button
        onClick={handleGenerate}
        disabled={status === 'generating' || !prompt}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'generating' ? 'Generating...' : 'Generate Image'}
      </button>

      {status && (
        <div className="mt-4">
          <p className="font-semibold">Status: {status}</p>

          {status === 'completed' && (
            <div className="mt-4">
              <img
                src={getGeneratedImage(requestId)}
                alt="Generated"
                className="max-w-md border rounded"
              />
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700">Error: {getError(requestId)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageGeneratorComponent;
