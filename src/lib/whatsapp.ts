// TODO: replace with CodeMath's real WhatsApp number (digits only, country code, no +)
export const WHATSAPP_NUMBER = "27000000000";

export const SERVICE_OPTIONS = [
  "Web Development",
  "Mobile App Development",
  "Custom Web Application",
  "Business Dashboards",
  "Online Store & E-commerce",
  "SEO & Digital Marketing",
  "UI/UX Design",
  "Graphic Design & Branding",
  "$27.50 Website Special (24hr)",
  "Other",
] as const;

export type ProjectEnquiry = { name: string; company: string; service: string; details?: string };

export function buildWhatsAppMessage(e: ProjectEnquiry): string {
  const lines = [
    "*New Project Enquiry — CodeMath*",
    "",
    `*Name:* ${e.name.trim()}`,
    `*Company:* ${e.company.trim()}`,
    `*Service:* ${e.service}`,
  ];
  if (e.details?.trim()) lines.push(`*Details:* ${e.details.trim()}`);
  lines.push("", "I understand payment commences as the project kicks off.");
  return lines.join("\n");
}

export function buildWhatsAppUrl(e: ProjectEnquiry): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(e))}`;
}
