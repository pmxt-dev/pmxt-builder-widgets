'use client';

import { SectionCta } from './landing/section-cta';
import { SectionHero } from './landing/section-hero';
import { SectionSandbox } from './landing/section-sandbox';
import { SectionStatus } from './landing/section-status';
import { SectionWedges } from './landing/section-wedges';
import { SiteFooter, SiteHeader } from './site-header';

/**
 * The landing page is a sequence of single-viewport beats. Each section
 * kills one skeptic objection; they're built as independent components
 * so the visual rhythm varies on purpose.
 */
export function Landing() {
    return (
        <div className="min-h-screen overflow-x-clip bg-[#fafafa] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
            <SiteHeader />
            <SectionHero />
            <SectionSandbox />
            <SectionStatus />
            <SectionWedges />
            <SectionCta />
            <SiteFooter />
        </div>
    );
}
