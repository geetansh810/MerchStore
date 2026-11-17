"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Check, Copy, QrCode, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import {
	getCheckoutPayAmount,
	getCheckoutPayCurrency,
	isCheckoutFreeOrder,
} from "@/checkout/lib/payment/checkout-pay-amount";
import {
	UPI_CURRENCY,
	buildUpiPaymentReference,
	buildUpiPaymentUri,
	buildUpiTransactionNote,
	formatUpiAmount,
	validateUpiTransactionId,
	type UpiQrConfig,
} from "@/checkout/lib/payment/providers/upi-qr";
import { getFormattedMoney } from "@/checkout/lib/utils/money";
import { Input } from "@/ui/components/ui/input";
import { cn } from "@/lib/utils";
import { UpiQrCode } from "./upi-qr-code";

type UpiPaymentPanelProps = {
	config: UpiQrConfig;
	checkout: CheckoutFragment;
	transactionId: string;
	onTransactionIdChange: (value: string) => void;
	transactionIdError?: string;
	disabled?: boolean;
};

const COPY_FEEDBACK_MS = 2000;

const CopyButton: FC<{ value: string; label: string; copiedLabel: string }> = ({
	value,
	label,
	copiedLabel,
}) => {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) {
				clearTimeout(timer.current);
			}
		},
		[],
	);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (timer.current) {
				clearTimeout(timer.current);
			}
			timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
		} catch {
			// Clipboard unavailable (insecure context / permissions) — the value stays visible to copy by hand.
		}
	}, [value]);

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
		>
			{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
			<span aria-live="polite">{copied ? copiedLabel : label}</span>
		</button>
	);
};

/**
 * Payment step UI for UPI QR manual payments: QR for the exact INR total, copyable details,
 * deep link for mobile and an optional UTR field. Placing the order creates an UNPAID order.
 */
export const UpiPaymentPanel: FC<UpiPaymentPanelProps> = ({
	config,
	checkout,
	transactionId,
	onTransactionIdChange,
	transactionIdError,
	disabled,
}) => {
	const t = useTranslations("checkout.payment.upi");

	const amount = getCheckoutPayAmount(checkout);
	const currency = getCheckoutPayCurrency(checkout);

	if (isCheckoutFreeOrder(checkout) || amount === null) {
		return null;
	}

	if (currency !== UPI_CURRENCY) {
		return (
			<section className="space-y-3">
				<h2 className="text-lg font-semibold">{t("title")}</h2>
				<p role="alert" className="text-sm text-destructive">
					{t("currencyUnsupported")}
				</p>
			</section>
		);
	}

	const formattedAmount = getFormattedMoney({ amount, currency });
	const reference = buildUpiPaymentReference(checkout.id);
	const note = buildUpiTransactionNote(reference);
	const uri = buildUpiPaymentUri({
		vpa: config.vpa,
		payeeName: config.payeeName,
		amount,
		note,
	});
	const plainAmount = formatUpiAmount(amount) ?? "";
	const useStaticQr = Boolean(config.staticQrImagePath);
	const validation = validateUpiTransactionId(transactionId, { required: config.requireTransactionId });
	const showUnusualHint = validation.status === "unusual";

	return (
		<section className="space-y-4">
			<h2 className="text-lg font-semibold">{t("title")}</h2>

			<p className="flex items-start gap-2 text-sm text-muted-foreground">
				<QrCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
				<span>
					{useStaticQr
						? t("staticQrInstruction", { amount: formattedAmount })
						: t("scanInstruction", { amount: formattedAmount })}
				</span>
			</p>

			<div className="flex justify-center">
				{useStaticQr && config.staticQrImagePath ? (
					<div className="rounded-lg border border-border bg-card p-3">
						{/* Merchant-supplied static asset from public/ — a plain img avoids a billed /_next/image transformation. */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={config.staticQrImagePath}
							alt={t("qrAlt", { amount: formattedAmount, payee: config.payeeName })}
							width={240}
							height={240}
							className="h-60 w-60 max-w-full object-contain"
						/>
					</div>
				) : uri ? (
					<UpiQrCode value={uri} label={t("qrAlt", { amount: formattedAmount, payee: config.payeeName })} />
				) : null}
			</div>

			<dl className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-muted-foreground">{t("payeeLabel")}</dt>
					<dd className="font-medium">{config.payeeName}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-muted-foreground">{t("upiIdLabel")}</dt>
					<dd className="flex items-center gap-2">
						<span className="break-all font-medium">{config.vpa}</span>
						<CopyButton value={config.vpa} label={t("copy")} copiedLabel={t("copied")} />
					</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-muted-foreground">{t("amountLabel")}</dt>
					<dd className="flex items-center gap-2">
						<span className="font-medium tabular-nums">{formattedAmount}</span>
						<CopyButton value={plainAmount} label={t("copy")} copiedLabel={t("copied")} />
					</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-muted-foreground">{t("referenceLabel")}</dt>
					<dd className="font-medium">{note}</dd>
				</div>
			</dl>

			{uri && !useStaticQr ? (
				<a
					href={uri}
					className={cn(
						"inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary md:hidden",
					)}
				>
					<Smartphone className="h-4 w-4" aria-hidden />
					{t("openApp")}
				</a>
			) : null}

			<div className="space-y-1.5">
				<label htmlFor="upi-transaction-id" className="text-sm font-medium">
					{config.requireTransactionId ? t("transactionIdLabelRequired") : t("transactionIdLabel")}
				</label>
				<Input
					id="upi-transaction-id"
					name="upiTransactionId"
					type="text"
					inputMode="text"
					autoComplete="off"
					autoCapitalize="characters"
					spellCheck={false}
					maxLength={40}
					value={transactionId}
					onChange={(event) => onTransactionIdChange(event.target.value)}
					disabled={disabled}
					required={config.requireTransactionId}
					aria-invalid={transactionIdError ? true : undefined}
					aria-describedby={transactionIdError ? "upi-transaction-id-error" : "upi-transaction-id-hint"}
				/>
				{transactionIdError ? (
					<p id="upi-transaction-id-error" role="alert" className="text-sm text-destructive">
						{transactionIdError}
					</p>
				) : (
					<p id="upi-transaction-id-hint" className="text-xs text-muted-foreground">
						{showUnusualHint ? t("transactionIdUnusual") : t("transactionIdHint")}
					</p>
				)}
			</div>

			<p className="text-sm text-muted-foreground">{t("verificationNotice")}</p>
		</section>
	);
};
