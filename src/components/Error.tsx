"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
}: {
  error: Error & { digest?: string; cause?: any };
}) {
  const [errorDetails, setErrorDetails] = useState<Record<string, any>>({});

  const genPuzzleExtensionUrl =
    "https://chromewebstore.google.com/detail/genpuzzle/pkokhbpdkolfhcbbghmopfcfbiamioie";

  useEffect(() => {
    const details: Record<string, any> = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };

    details.url = window.location.href;
    details.timestamp = new Date().toISOString();

    setErrorDetails(details);
  }, [error]);

  const showExtensionPrompt = Boolean(
    (error.stack &&
      (error.stack.includes("nkbihfbeogaeaoehlefnkodbefgpgknn") ||
        error.stack.includes("inpage.js") ||
        error.stack.includes("Object.connect"))) ||
      (error.message && error.message.includes("Object.connect"))
  );

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4">
      <div className="text-2xl font-semibold text-red-500">Error</div>
      {showExtensionPrompt && (
        <div className="mt-2 max-w-xl text-center text-sm text-gray-700">
          It looks like a browser extension is needed. Please download the
          GenPuzzle Chrome extension to continue.
          <div className="mt-3">
            <Button
              onClick={() => window.open(genPuzzleExtensionUrl, "_blank")}
              variant="outline"
            >
              Download GenPuzzle Extension
            </Button>
          </div>
        </div>
      )}
      <Button
        onClick={() => {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: "IFRAME_ERROR",
                payload: errorDetails,
              },
              "*"
            );
          }
        }}
        variant="default"
        className="mt-4 cursor-pointer"
      >
        Fix Error
      </Button>
    </div>
  );
}
