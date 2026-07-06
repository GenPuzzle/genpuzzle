'use client';

import { LandingNav } from '@/components/marketing/landing/LandingNav';
import { HeroSection } from '@/components/marketing/landing/HeroSection';
import { StatusBar } from '@/components/marketing/landing/StatusBar';
import { BentoFeatures } from '@/components/marketing/landing/BentoFeatures';
import { BeforeAfterSection } from '@/components/marketing/landing/BeforeAfterSection';
import { PuzzleLibrary } from '@/components/marketing/landing/PuzzleLibrary';
import { AboutSection } from '@/components/marketing/landing/AboutSection';
import { SocialProofSection } from '@/components/marketing/landing/SocialProofSection';
import { ArticlesSection } from '@/components/marketing/landing/ArticlesSection';
import { TemplatesSection } from '@/components/marketing/landing/TemplatesSection';
import { LandingFooter } from '@/components/marketing/landing/LandingFooter';

interface MarketingLandingProps {
  appHref: string;
}

export function MarketingLanding({ appHref }: MarketingLandingProps) {
  return (
    <div className="min-h-screen bg-white font-sans antialiased dark:bg-slate-950">
      <LandingNav appHref={appHref} />
      <HeroSection appHref={appHref} />
      <StatusBar />
      <BentoFeatures />
      <BeforeAfterSection />
      <PuzzleLibrary appHref={appHref} />
      <AboutSection />
      <SocialProofSection />
      <ArticlesSection />
      <TemplatesSection appHref={appHref} />
      <LandingFooter appHref={appHref} />
    </div>
  );
}
