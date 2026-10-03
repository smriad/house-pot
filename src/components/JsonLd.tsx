import { SITE_NAME, siteUrl } from "@/lib/site";

export default function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "Open-weight Gemma meal planner for a friend who cooks — pantry memory, human approval, and optional ElevenLabs narration.",
    url: siteUrl(),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
