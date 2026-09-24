import Link from "next/link";
import { contactEmail } from "@/lib/site";

const LINKS = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
  { href: "/seguranca", label: "Segurança" },
];

export function SiteFooter() {
  const contact = contactEmail();
  return (
    <footer className="mt-auto border-t border-line px-5 py-5">
      <nav aria-label="Informação legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-mute">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-mist">
            {item.label}
          </Link>
        ))}
        {contact ? (
          <a href={`mailto:${contact}`} className="hover:text-mist">
            Contacto
          </a>
        ) : null}
      </nav>
      <p className="mt-3 text-center text-[11px] text-mute/80">
        Aquastats não cobra neste lançamento e nunca guarda números de cartão.
      </p>
    </footer>
  );
}
