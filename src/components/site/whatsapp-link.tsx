import { MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { whatsappLink } from "@/utils/whatsapp";

/** A button that opens a WhatsApp chat with `phone` (country code included), in a new tab. */
export function WhatsAppLink({ phone, label }: { phone: string; label: string }) {
  return (
    <a
      href={whatsappLink(phone)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant: "secondary", size: "lg", className: `w-full ${slideParent}` })}
    >
      <SlideLabel icon={MessageCircle}>{label}</SlideLabel>
    </a>
  );
}
