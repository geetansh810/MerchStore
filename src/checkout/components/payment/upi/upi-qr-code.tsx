"use client";

import { useMemo, type FC } from "react";
import { encode } from "uqr";

type UpiQrCodeProps = {
	/** Payload to encode — a `upi://pay?...` URI. */
	value: string;
	/** Rendered width/height in CSS pixels. */
	size?: number;
	/** Accessible description of the code. */
	label: string;
};

/**
 * Client-side QR rendered as a single SVG path (no images, no innerHTML).
 * `currentColor` + the card background keep it themeable; the quiet zone comes from `border`.
 */
export const UpiQrCode: FC<UpiQrCodeProps> = ({ value, size = 224, label }) => {
	const { path, dimension } = useMemo(() => {
		const { data } = encode(value, { ecc: "M", border: 2 });
		const commands: string[] = [];
		data.forEach((row, y) => {
			row.forEach((dark, x) => {
				if (dark) {
					commands.push(`M${x} ${y}h1v1h-1z`);
				}
			});
		});
		return { path: commands.join(""), dimension: data.length };
	}, [value]);

	return (
		<div className="inline-block rounded-lg border border-border bg-card p-3 text-foreground">
			<svg
				role="img"
				aria-label={label}
				viewBox={`0 0 ${dimension} ${dimension}`}
				width={size}
				height={size}
				shapeRendering="crispEdges"
				className="block max-w-full"
			>
				<path d={path} fill="currentColor" />
			</svg>
		</div>
	);
};
