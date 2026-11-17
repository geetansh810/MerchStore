import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { type OrderPaymentState } from "@/lib/order-payment-state";

type Props = {
	state: Exclude<OrderPaymentState, "unknown">;
	label: string;
};

const stateStyle = {
	paid: { icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" },
	partially_paid: { icon: AlertCircle, className: "border-border bg-secondary text-muted-foreground" },
	pending_verification: { icon: Clock, className: "border-border bg-secondary text-muted-foreground" },
} as const;

/** Pill showing whether an order has been paid. Presentational — label comes from the caller. */
export function OrderPaymentBadge({ state, label }: Props) {
	const { icon: Icon, className } = stateStyle[state];

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${className}`}
		>
			<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
			{label}
		</span>
	);
}
