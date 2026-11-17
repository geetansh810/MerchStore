import { cn } from "@/lib/utils";
import { NavHrefLink } from "@/ui/atoms/nav-href-link";
import { buttonClassName } from "@/ui/components/ui/button";

export interface AnniversaryHeroCta {
	label: string;
	href: string;
}

export interface AnniversaryHeroProps {
	/** Unique heading id for `aria-labelledby` (the h1). */
	id?: string;
	eyebrow?: string;
	heading: string;
	subheading?: string;
	/** Large decorative numeral, e.g. "70". Hidden from assistive tech — the heading carries the meaning. */
	numeral: string;
	numeralCaption?: string;
	primaryCta: AnniversaryHeroCta;
	secondaryCta?: AnniversaryHeroCta;
	className?: string;
}

/**
 * Abstract contrail motif: long sweeping lines, tiny chevrons in formation and a few "stars".
 * Deliberately generic — no emblem, roundel, insignia or identifiable aircraft.
 */
function ContrailMotif({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 1200 600"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
			focusable="false"
			fill="none"
			stroke="currentColor"
			className={className}
		>
			<path d="M-40 520 C 280 430, 560 300, 1240 90" strokeWidth="1.5" strokeLinecap="round" />
			<path
				d="M-40 560 C 320 480, 640 370, 1240 190"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeDasharray="2 10"
			/>
			<path d="M-40 600 C 360 540, 700 450, 1240 300" strokeWidth="1.5" strokeLinecap="round" />
			<g fill="currentColor" stroke="none">
				<path d="M900 150 l22 14 l-22 -5 l-22 5 z" />
				<path d="M960 112 l16 10 l-16 -4 l-16 4 z" />
				<path d="M1020 80 l12 8 l-12 -3 l-12 3 z" />
				<circle cx="140" cy="90" r="2" />
				<circle cx="310" cy="140" r="2" />
				<circle cx="520" cy="60" r="2" />
				<circle cx="760" cy="210" r="2" />
				<circle cx="1110" cy="330" r="2" />
			</g>
		</svg>
	);
}

/**
 * Anniversary hero: deep-navy band with a sky-blue radial glow, an oversized decorative
 * numeral and a contrail motif. Pure Server Component, no client JS, no image required.
 */
export function AnniversaryHero({
	id = "homepage-hero-heading",
	eyebrow,
	heading,
	subheading,
	numeral,
	numeralCaption,
	primaryCta,
	secondaryCta,
	className,
}: AnniversaryHeroProps) {
	return (
		<section
			aria-labelledby={id}
			className={cn(
				"relative isolate overflow-hidden bg-primary bg-hero-sky text-primary-foreground",
				className,
			)}
		>
			<ContrailMotif className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-highlight/30" />
			<div className="container-content grid items-center gap-10 px-4 py-section-md sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-section-lg">
				<div>
					{eyebrow ? <p className="text-eyebrow uppercase text-highlight">{eyebrow}</p> : null}
					<h1 id={id} className={cn("text-balance text-display", eyebrow && "mt-4")}>
						{heading}
					</h1>
					{subheading ? (
						<p className="mt-6 max-w-prose text-pretty text-lead text-primary-foreground/80">{subheading}</p>
					) : null}
					<div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
						<NavHrefLink
							href={primaryCta.href}
							className={buttonClassName({
								asLink: true,
								size: "lg",
								variant: "secondary",
								className: "w-full sm:w-auto",
							})}
						>
							{primaryCta.label}
						</NavHrefLink>
						{secondaryCta ? (
							<NavHrefLink
								href={secondaryCta.href}
								className={buttonClassName({
									asLink: true,
									size: "lg",
									variant: "outline-solid",
									className:
										"w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto",
								})}
							>
								{secondaryCta.label}
							</NavHrefLink>
						) : null}
					</div>
				</div>
				<div aria-hidden="true" className="hidden lg:block lg:justify-self-end lg:text-right">
					<p className="font-display text-numeral text-primary-foreground max-lg:text-[6rem]">{numeral}</p>
					{numeralCaption ? (
						<p className="mt-2 text-eyebrow uppercase text-highlight">{numeralCaption}</p>
					) : null}
				</div>
			</div>
		</section>
	);
}
