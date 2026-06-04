'use client';

import React, { useState } from 'react';
import { AppProvider } from '@/lib/app-context';
import { WordSearchSidebar } from '@/components/WordSearchSidebar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { Menu } from 'lucide-react';
import { useApp } from '@/lib/app-context';

function PuzzleGeneratorApp() {
  const { currentPuzzleType } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isWordSearch = currentPuzzleType === 'word-search';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Toggle (Mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-300`}
      >
        {isWordSearch ? <WordSearchSidebar /> : <WordSearchSidebar />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Preview */}
        <div className="flex-1 overflow-auto p-6">
          <PreviewCanvas />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <PuzzleGeneratorApp />
    </AppProvider>
  );
}
