import { PERSONALISED_NAME_HTML_PATTERN } from "@/lib/personalisation";

interface PersonalisedNameFieldProps {
	maxLength: number;
	label: string;
	hint: string;
}

/**
 * Name-to-print input for personalised products. Server Component, no client state: native
 * `required` / `maxLength` / `pattern` validation blocks submit from both the main add-to-cart
 * button and the mobile sticky bar (they share one form). The server action re-validates.
 */
export function PersonalisedNameField({ maxLength, label, hint }: PersonalisedNameFieldProps) {
	return (
		<div className="space-y-2">
			<label htmlFor="personalisedName" className="text-sm font-medium text-foreground">
				{label}
			</label>
			<input
				id="personalisedName"
				name="personalisedName"
				type="text"
				required
				maxLength={maxLength}
				pattern={PERSONALISED_NAME_HTML_PATTERN}
				autoComplete="off"
				autoCapitalize="words"
				aria-describedby="personalisedName-hint"
				className="h-12 w-full rounded-button border border-input bg-background px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<p id="personalisedName-hint" className="text-xs text-muted-foreground">
				{hint}
			</p>
		</div>
	);
}
