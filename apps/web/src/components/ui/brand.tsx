import Image from "next/image";

export function WaveMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/aquastats-mark.webp"
      alt=""
      width={80}
      height={80}
      className={`${className} object-contain`}
      priority
    />
  );
}

export function BrandLockup({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/aquastats-mark.webp"
        alt=""
        width={40}
        height={40}
        className={`${compact ? "h-7 w-7" : "h-8 w-8"} object-contain ${onDark ? "brightness-0 invert" : ""}`}
        priority
      />
      <span
        className={`font-display font-bold tracking-wide ${onDark ? "text-white" : "text-aqua"} ${
          compact ? "text-xl" : "text-2xl"
        }`}
      >
        aquastats
      </span>
    </span>
  );
}

export function BrandLockupFull({ className = "h-28 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/aquastats-logo.webp"
      alt="Aquastats"
      width={320}
      height={314}
      className={`${className} object-contain object-left`}
      priority
    />
  );
}
