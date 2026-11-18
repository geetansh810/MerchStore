"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { HeroSlide } from "@/config/hero-slides";
import { cn } from "@/lib/utils";
import { NavHrefLink } from "@/ui/atoms/nav-href-link";
import { buttonClassName } from "@/ui/components/ui/button";

export interface BannerHeroProps {
	/** Unique heading id for `aria-labelledby`. */
	id?: string;
	/** Page h1 — visually hidden; each slide carries its own visible headline. */
	heading: string;
	slides: readonly HeroSlide[];
	/** Auto-advance interval; disabled under `prefers-reduced-motion`. */
	intervalMs?: number;
	className?: string;
}

/**
 * Homepage hero: photo slides with live text over a navy fade (same type scale and CTAs as the
 * original anniversary hero). Slides stack in one grid cell so the band takes the tallest slide's
 * height. Autoplay pauses on hover/focus and is off for reduced-motion users.
 */
export function BannerHero({
	id = "homepage-hero-heading",
	heading,
	slides,
	intervalMs = 7000,
	className,
}: BannerHeroProps) {
	const [active, setActive] = useState(0);
	const [paused, setPaused] = useState(false);
	const count = slides.length;

	const next = useCallback(() => setActive((i) => (i + 1) % count), [count]);

	useEffect(() => {
		if (count < 2 || paused) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const timer = window.setInterval(next, intervalMs);
		return () => window.clearInterval(timer);
	}, [count, paused, next, intervalMs]);

	if (count === 0) return null;

	return (
		<section
			aria-labelledby={id}
			aria-roledescription="carousel"
			className={cn("relative isolate grid overflow-hidden bg-primary text-primary-foreground", className)}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={() => setPaused(false)}
		>
			<h1 id={id} className="sr-only">
				{heading}
			</h1>

			{slides.map((slide, index) => {
				const isActive = index === active;
				return (
					<div
						key={slide.heading}
						role="group"
						aria-roledescription="slide"
						aria-label={`${index + 1} of ${count}`}
						aria-hidden={!isActive}
						inert={!isActive}
						className={cn(
							"relative isolate col-start-1 row-start-1 flex min-h-[560px] items-center transition-opacity duration-slow ease-standard motion-reduce:transition-none lg:min-h-[min(78svh,680px)]",
							isActive ? "z-10 opacity-100" : "opacity-0",
						)}
					>
						{/* Photo: full-bleed behind text on mobile; right ~70% on desktop. */}
						<div className="absolute inset-y-0 right-0 -z-20 w-full lg:w-[72%]">
							<Image
								src={slide.image}
								alt={slide.imageAlt}
								fill
								priority={index === 0}
								placeholder="blur"
								sizes="(min-width: 1024px) 72vw, 100vw"
								className="object-cover"
								style={{ objectPosition: slide.imagePosition }}
							/>
						</div>
						{/* Navy fade so live text stays legible over the photo. */}
						<div
							aria-hidden="true"
							className="absolute inset-0 -z-10 bg-gradient-to-t from-primary via-primary/80 to-primary/40 lg:bg-gradient-to-r lg:from-primary lg:from-30% lg:via-primary/70 lg:via-50% lg:to-transparent"
						/>

						<div className="container-content w-full px-4 py-section-md sm:px-6 lg:py-section-lg">
							<div className="max-w-xl">
								<p className="text-eyebrow uppercase text-highlight">{slide.eyebrow}</p>
								<h2 className="mt-4 text-balance text-display">{slide.heading}</h2>
								<p className="mt-6 max-w-prose text-pretty text-lead text-primary-foreground/85">
									{slide.subheading}
								</p>
								<div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
									<NavHrefLink
										href={slide.primaryCta.href}
										className={buttonClassName({
											asLink: true,
											size: "lg",
											variant: "secondary",
											className: "w-full sm:w-auto",
										})}
									>
										{slide.primaryCta.label}
									</NavHrefLink>
									{slide.secondaryCta ? (
										<NavHrefLink
											href={slide.secondaryCta.href}
											className={buttonClassName({
												asLink: true,
												size: "lg",
												variant: "outline-solid",
												className:
													"w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto",
											})}
										>
											{slide.secondaryCta.label}
										</NavHrefLink>
									) : null}
								</div>
							</div>
						</div>

						<a
							href={slide.credit.href}
							target="_blank"
							rel="noopener noreferrer"
							className="absolute bottom-2 right-3 text-[10px] text-primary-foreground/60 no-underline hover:text-primary-foreground hover:underline"
						>
							{slide.credit.label}
						</a>
					</div>
				);
			})}

			{count > 1 ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-6 z-20">
					<div className="container-content flex gap-1 px-4 sm:px-6">
						{slides.map((slide, index) => (
							<button
								key={slide.heading}
								type="button"
								onClick={() => setActive(index)}
								aria-label={`Show slide ${index + 1} of ${count}: ${slide.heading}`}
								aria-current={index === active}
								className="group/dot pointer-events-auto flex h-6 items-center px-1"
							>
								<span
									aria-hidden="true"
									className={cn(
										"block h-1.5 rounded-full transition-all duration-base ease-standard motion-reduce:transition-none",
										index === active
											? "w-8 bg-primary-foreground"
											: "w-4 bg-primary-foreground/40 group-hover/dot:bg-primary-foreground/70",
									)}
								/>
							</button>
						))}
					</div>
				</div>
			) : null}
		</section>
	);
}
