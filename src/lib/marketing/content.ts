/** Marketing articles — replace with database/API fetch later. */
export interface MarketingArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readMinutes: number;
  coverGradient: string;
}

/** Puzzle book templates — metadata; .gp files served from /templates/{id}.gp */
export interface MarketingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trimSize: string;
  pageCount: string;
  badge?: string;
  accent: string;
  gpFile: string;
}

export type PuzzleTypeStatus = 'live' | 'coming-soon';

export interface MarketingPuzzleType {
  id: string;
  name: string;
  description: string;
  status: PuzzleTypeStatus;
  icon: 'grid' | 'crossword' | 'sudoku' | 'maze' | 'cryptogram' | 'logic' | 'scramble' | 'dots';
  accent: string;
}

export const MARKETING_NAV = [
  { id: 'hero', label: 'Home', href: '#hero' },
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'puzzles', label: 'Puzzle Library', href: '#puzzles' },
  { id: 'articles', label: 'Articles', href: '#articles' },
  { id: 'templates', label: 'Templates', href: '#templates' },
] as const;

export const SOCIAL_PROOF_STATS = [
  { label: 'Puzzles created', value: '12,450+', hint: 'and growing daily' },
  { label: 'Books exported', value: '3,200+', hint: 'KDP-ready PDFs' },
  { label: 'Avg. time to first export', value: '18 min', hint: 'from blank to print' },
  { label: 'Creator satisfaction', value: '4.9/5', hint: 'beta feedback' },
] as const;

export const BENTO_FEATURES = [
  {
    id: 'canvas',
    title: 'Live Canvas Editor',
    description:
      'Edit titles, grids, and word lists with real-time page preview. What you see is what prints.',
    size: 'large' as const,
    gradient: 'from-[#1a5a8c] via-[#2276b4] to-[#38bdf8]',
  },
  {
    id: 'pages',
    title: 'Drag-and-Drop Pages',
    description: 'Browser-style document tabs. Reorder, duplicate, and manage multi-page books effortlessly.',
    size: 'medium' as const,
    gradient: 'from-[#0f766e] to-[#2dd4bf]',
  },
  {
    id: 'export',
    title: 'KDP-Ready Export',
    description: 'One-click PDF & PowerPoint export with trim sizes, bleed, and print-safe margins built in.',
    size: 'medium' as const,
    gradient: 'from-[#4338ca] to-[#818cf8]',
  },
  {
    id: 'templates',
    title: 'Starter Templates',
    description: 'Open .gp templates and customize fonts, colors, and layout — publish faster.',
    size: 'small' as const,
    gradient: 'from-[#b45309] to-[#fbbf24]',
  },
  {
    id: 'flipbook',
    title: '3D Book Preview',
    description: 'Flip through your compiled book before export.',
    size: 'small' as const,
    gradient: 'from-[#7c3aed] to-[#c4b5fd]',
  },
] as const;

export const PUZZLE_TYPES: MarketingPuzzleType[] = [
  {
    id: 'word-search',
    name: 'Word Search',
    description: 'Custom grids, fonts, and word lists with live preview.',
    status: 'live',
    icon: 'grid',
    accent: '#2276b4',
  },
  {
    id: 'crossword',
    name: 'Crosswords',
    description: 'Classic crossword layouts for themed puzzle books.',
    status: 'coming-soon',
    icon: 'crossword',
    accent: '#0f766e',
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    description: 'Difficulty tiers from easy to expert.',
    status: 'coming-soon',
    icon: 'sudoku',
    accent: '#4338ca',
  },
  {
    id: 'maze',
    name: 'Mazes',
    description: 'Printable mazes in multiple sizes.',
    status: 'coming-soon',
    icon: 'maze',
    accent: '#b45309',
  },
  {
    id: 'cryptogram',
    name: 'Cryptograms',
    description: 'Encoded phrase puzzles for brain-teaser books.',
    status: 'coming-soon',
    icon: 'cryptogram',
    accent: '#be185d',
  },
  {
    id: 'logic',
    name: 'Logic Puzzles',
    description: 'Deduction grids and brain games.',
    status: 'coming-soon',
    icon: 'logic',
    accent: '#0369a1',
  },
  {
    id: 'scramble',
    name: 'Word Scramble',
    description: 'Jumbled word challenges by theme.',
    status: 'coming-soon',
    icon: 'scramble',
    accent: '#7c3aed',
  },
  {
    id: 'dots',
    name: 'Dot to Dot',
    description: 'Connect-the-dots for kids and activity books.',
    status: 'coming-soon',
    icon: 'dots',
    accent: '#059669',
  },
];

export const LATEST_ARTICLES: MarketingArticle[] = [
  {
    id: '1',
    slug: 'how-to-publish-word-search-books-on-kdp',
    title: 'How to Publish Word Search Books on Amazon KDP',
    excerpt:
      'A practical walkthrough of trim sizes, bleed settings, and export checks before you upload your puzzle book.',
    category: 'Publishing',
    publishedAt: '2026-06-18',
    readMinutes: 8,
    coverGradient: 'linear-gradient(135deg, #1a5a8c 0%, #38bdf8 100%)',
  },
  {
    id: '2',
    slug: 'designing-large-print-puzzle-books',
    title: 'Designing Large-Print Puzzle Books for Seniors',
    excerpt:
      'Font sizes, grid spacing, and contrast tips that make your books easier to read and more marketable.',
    category: 'Design',
    publishedAt: '2026-06-10',
    readMinutes: 6,
    coverGradient: 'linear-gradient(135deg, #0f766e 0%, #5eead4 100%)',
  },
  {
    id: '3',
    slug: 'genpuzzle-templates-workflow',
    title: 'Start Faster with GenPuzzle Templates',
    excerpt:
      'Open a ready-made .gp template, customize the layout in the editor, and export your first book in minutes.',
    category: 'Product',
    publishedAt: '2026-06-02',
    readMinutes: 5,
    coverGradient: 'linear-gradient(135deg, #7c3aed 0%, #c4b5fd 100%)',
  },
];

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    id: 'kids-word-search',
    name: 'Kids Word Search',
    description: 'Bright, playful layout with a 12×12 grid — great for ages 6–10.',
    category: 'Word Search',
    trimSize: '8.5 × 11 in',
    pageCount: '1 puzzle page',
    badge: 'Popular',
    accent: '#f59e0b',
    gpFile: '/templates/kids-word-search.gp',
  },
  {
    id: 'kdp-classic',
    name: 'KDP Classic Layout',
    description: 'Clean professional styling sized for standard KDP paperback uploads.',
    category: 'Word Search',
    trimSize: '8.5 × 11 in',
    pageCount: '1 puzzle page',
    accent: '#1a5a8c',
    gpFile: '/templates/kdp-classic.gp',
  },
  {
    id: 'large-print',
    name: 'Large Print Seniors',
    description: 'Bigger letters, wider spacing, and high-contrast colors for accessibility.',
    category: 'Word Search',
    trimSize: '8.5 × 11 in',
    pageCount: '1 puzzle page',
    badge: 'Accessible',
    accent: '#0f766e',
    gpFile: '/templates/large-print.gp',
  },
  {
    id: 'spanish-starter',
    name: 'Spanish Starter Book',
    description: 'Spanish-friendly title styling and word-list layout to localize fast.',
    category: 'Word Search',
    trimSize: '8.5 × 11 in',
    pageCount: '1 puzzle page',
    accent: '#dc2626',
    gpFile: '/templates/spanish-starter.gp',
  },
];

export function getArticleBySlug(slug: string): MarketingArticle | undefined {
  return LATEST_ARTICLES.find((article) => article.slug === slug);
}

export function getTemplateById(id: string): MarketingTemplate | undefined {
  return MARKETING_TEMPLATES.find((template) => template.id === id);
}

export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildAppTemplateHref(appHref: string, templateId: string): string {
  const base = appHref.replace(/\/$/, '');
  return `${base}?template=${encodeURIComponent(templateId)}`;
}

export function buildAppHref(appHref: string): string {
  return appHref.replace(/\/$/, '') || '/app';
}
