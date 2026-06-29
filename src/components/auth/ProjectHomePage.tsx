'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { FolderOpen, FilePlus2, LayoutTemplate, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useLeavePagePrompt } from '@/lib/leave-page-prompt-context';
import { useApp } from '@/lib/app-context';
import { GP_FILE_EXTENSION, readGpProjectFromFile } from '@/lib/project-file';
import { toast } from 'sonner';

interface ProjectHomePageProps {
  onEnterEditor: () => void;
}

export function ProjectHomePage({ onEnterEditor }: ProjectHomePageProps) {
  const { session, logout } = useAuth();
  const { promptLeave } = useLeavePagePrompt();
  const app = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = () => {
    promptLeave(() => logout(), { reason: 'sign-out' });
  };

  const handleNewProject = () => {
    app.resetToNewProject();
    onEnterEditor();
    toast.success('New project created');
  };

  const handleOpenProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const project = await readGpProjectFromFile(file);
      app.loadProjectSnapshot(project);
      onEnterEditor();
      toast.success(`Opened "${project.projectName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open project');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#f0f5f6] via-white to-[#e8f1f8]">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/genpuzzle-icon.svg"
            alt="GenPuzzle"
            width={32}
            height={32}
            className="h-8 w-8"
            unoptimized
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">GenPuzzle</p>
            <p className="text-xs text-slate-500">
              Welcome{session?.username ? `, ${session.username}` : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900">What would you like to do?</h1>
            <p className="mt-2 text-slate-600">
              Open an existing puzzle book, start fresh, or browse templates.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={GP_FILE_EXTENSION}
            className="hidden"
            onChange={handleFileSelected}
          />

          <div className="grid gap-5 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleOpenProject}
              className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-[var(--gp-blue)] hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[var(--gp-blue)] transition group-hover:bg-[var(--gp-blue)] group-hover:text-white">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Open project</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Load a saved GenPuzzle project file from your computer.
              </p>
            </button>

            <button
              type="button"
              onClick={handleNewProject}
              className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-[var(--gp-blue)] hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white">
                <FilePlus2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">New project</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Start a blank puzzle book from scratch.
              </p>
            </button>

            <button
              type="button"
              disabled
              className="relative flex flex-col items-start rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-left opacity-80"
            >
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <Clock className="h-3 w-3" />
                Coming soon
              </span>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700">Use our templates</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Browse ready-made puzzle book layouts from our library.
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
