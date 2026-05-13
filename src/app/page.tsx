'use client';

import React, { useState } from 'react';
import { AppProvider } from '@/lib/app-context';
import { WordSearchSidebar } from '@/components/WordSearchSidebar';
import { PuzzleDashboard } from '@/components/PuzzleDashboard';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { SavedPuzzlesLibrary } from '@/components/SavedPuzzlesLibrary';
import { Button } from '@/components/ui/button';
import { FolderOpen, Menu } from 'lucide-react';
import { useApp } from '@/lib/app-context';

function PuzzleGeneratorApp() {
  const { currentPuzzleType } = useApp();
  const [showLibrary, setShowLibrary] = useState(false);
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
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 ml-10 lg:ml-0">
            <h1 className="text-xl font-bold text-gray-900">
              {isWordSearch ? 'Word Search Generator' : 'Puzzle Generator Suite'}
            </h1>
            <span className="text-sm text-gray-500">for KDP Publishing</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLibrary(true)}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            My Puzzles
          </Button>
        </header>

        {/* Dashboard & Preview */}
        <div className="flex-1 overflow-auto p-6">
          <PuzzleDashboard />
          <PreviewCanvas />
        </div>
      </div>

      {/* Saved Puzzles Library Modal */}
      <SavedPuzzlesLibrary
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
      />
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
