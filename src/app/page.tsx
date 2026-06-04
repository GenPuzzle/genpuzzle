'use client';

import React, { useState } from 'react';
import { AppProvider } from '@/lib/app-context';
import { WordSearchSidebar } from '@/components/WordSearchSidebar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { Menu, X } from 'lucide-react';
import { useApp } from '@/lib/app-context';

function PuzzleGeneratorApp() {
  const { currentPuzzleType } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isWordSearch = currentPuzzleType === 'word-search';

  return (
    <div className="flex h-screen" style={{background: 'linear-gradient(to bottom right, #F0F5F6, #ffffff)'}}>
      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2s" style={{background: 'rgba(34, 118, 180, 0.3)'}}></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-4s"></div>
      </div>

      {/* Sidebar Toggle (Mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-110 active:scale-95"
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 text-slate-700 dark:text-white" />
        ) : (
          <Menu className="w-5 h-5 text-slate-700 dark:text-white" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 transition-all duration-300 ease-out transform`}
      >
        {isWordSearch ? <WordSearchSidebar /> : <WordSearchSidebar />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 backdrop-blur-sm">
        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 animate-fade-in">
          <div className="h-full rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-white/20 dark:ring-slate-700/20 overflow-hidden">
            <PreviewCanvas />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2s {
          animation-delay: 2s;
        }
        
        .animation-delay-4s {
          animation-delay: 4s;
        }
      `}</style>
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
