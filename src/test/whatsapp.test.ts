import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp";

describe("WhatsApp enquiry", () => {
  const e = { name: " Tendai ", company: "Moyo Logistics", service: "Web Development" };
  it("includes name, company and service", () => {
    const m = buildWhatsAppMessage(e);
    expect(m).toContain("*Name:* Tendai");
    expect(m).toContain("*Company:* Moyo Logistics");
    expect(m).toContain("*Service:* Web Development");
  });
  it("opens a chat with the business number, message encoded", () => {
    const u = buildWhatsAppUrl(e);
    expect(u.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(u).not.toContain(" ");
  });
});
