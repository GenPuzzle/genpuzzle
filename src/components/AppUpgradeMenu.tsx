'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { Crown, Rocket, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    credits: '50 credits',
    price: '$10',
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: '100 AI credits',
    price: '$20',
    icon: Rocket,
  },
  {
    id: 'business',
    name: 'Business',
    credits: '500 credits',
    price: '$30',
    icon: Crown,
  },
] as const;

export function AppUpgradeMenu() {
  const handleSelectPlan = (planName: string) => {
    toast.info(`${planName} plan checkout coming soon`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <HeaderExpandButton
          expandSize="xxl"
          label="Upgrade your plan"
          icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />}
          aria-label="Upgrade your plan"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
          Upgrade your plan
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <DropdownMenuItem
              key={plan.id}
              className="cursor-pointer py-2.5"
              onClick={() => handleSelectPlan(plan.name)}
            >
              <Icon className="h-4 w-4 text-[var(--gp-blue)]" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-800">{plan.name}</span>
                <span className="text-xs text-slate-500">
                  {plan.credits} · {plan.price}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
