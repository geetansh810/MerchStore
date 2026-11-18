import formationPhoto from "@/assets/hero/su30mki-mirage-formation.jpg";
import su30Photo from "@/assets/hero/su30mki-blue-sky.jpg";
import { anniversaryCampaign } from "@/config/campaign";

type LocalImage = typeof su30Photo;

export interface HeroSlideCredit {
	/** e.g. "Photo: Sanil Nath / CC BY 4.0" — required by the image licence. */
	label: string;
	href: string;
}

export interface HeroSlide {
	eyebrow: string;
	heading: string;
	subheading: string;
	image: LocalImage;
	imageAlt: string;
	/** CSS object-position for the photo (keeps the aircraft in frame when cropped). */
	imagePosition?: string;
	primaryCta: { label: string; href: string };
	secondaryCta?: { label: string; href: string };
	credit: HeroSlideCredit;
}

/**
 * Homepage hero slides. Photos are freely licensed from Wikimedia Commons — keep the credit
 * line when swapping copy; replace the credit too if you swap the photo.
 */
export const heroSlides: readonly HeroSlide[] = [
	{
		eyebrow: "Air Superiority",
		heading: "Lightnings",
		subheading: "20 Squadron IAF — Platinum Jubilee Collection.",
		image: su30Photo,
		imageAlt: "Indian Air Force Su-30MKI in flight against a deep blue sky",
		imagePosition: "60% 50%",
		primaryCta: { label: "Shop the power", href: `/collections/${anniversaryCampaign.collectionSlug}` },
		secondaryCta: { label: "Browse all", href: "/products" },
		credit: {
			label: "Photo: Sanil Nath / CC BY 4.0",
			href: "https://commons.wikimedia.org/wiki/File:Su-30MKI.jpg",
		},
	},
	{
		eyebrow: "Silhouette Tribute",
		heading: "20 Sqn IAF Lightnings",
		subheading: "Since 1954: a legacy in the skies.",
		image: formationPhoto,
		imageAlt: "Indian Air Force Su-30MKI and Mirage 2000 jets flying in formation",
		imagePosition: "65% 45%",
		primaryCta: { label: "View the silhouette range", href: "/products" },
		credit: {
			label: "Photo: Ministry of Defence, Government of India / GODL-India",
			href: "https://commons.wikimedia.org/wiki/File:Su-30MKI_and_Mirage-2000_at_Air_Force_Day_Parade,_at_Air_Force_Station_Hindan,_in_Ghaziabad_on_October_08,_2019.jpg",
		},
	},
];
