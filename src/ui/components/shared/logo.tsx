/**
 * Shared Logo Component — token-coloured wordmark with an abstract "70" mark.
 *
 * Inherits colour from the surrounding text tokens, so it works on light surfaces and (with
 * `inverted`) on dark bands such as the footer. No image asset is involved.
 *
 * @example
 * <Logo className="h-7 w-auto" />
 * <Logo className="h-7 w-auto" inverted />
 */
import { brandConfig } from "@/config/brand";
import { cn } from "@/lib/utils";

interface LogoProps {
	className?: string;
	/** Accessible label for the logo. Pass an empty string when adjacent text already names the brand. */
	ariaLabel?: string;
	/** Light logo for dark/inverted backgrounds (footer) */
	inverted?: boolean;
}

/** Abstract mark: rounded square, three rising chevrons and a contrail arc. Not an emblem. */
function LogoMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden="true" className={className}>
			<rect x="1.5" y="1.5" width="29" height="29" rx="7" strokeWidth="1.75" />
			<path d="M9 21 L16 13 L23 21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			<path
				d="M11.5 24 L16 18.5 L20.5 24"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.7"
			/>
			<path d="M7 9 C 13 6.5, 19 6.5, 25 9" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
		</svg>
	);
}

export const Logo = ({ className, ariaLabel = brandConfig.logoAriaLabel, inverted = false }: LogoProps) => (
	<span
		role={ariaLabel ? "img" : undefined}
		aria-label={ariaLabel || undefined}
		aria-hidden={ariaLabel ? undefined : true}
		className={cn(
			"inline-flex items-center gap-2 whitespace-nowrap",
			inverted ? "text-background" : "text-foreground",
			className,
		)}
	>
		<LogoMark className="h-full w-auto" />
		<span className="font-display text-lg font-semibold leading-none tracking-tight" aria-hidden="true">
			{brandConfig.siteName}
		</span>
	</span>
);
