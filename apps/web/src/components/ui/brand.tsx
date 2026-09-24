import Image from "next/image";

export function WaveMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/aquastats-mark.png"
      alt=""
      width={80}
      height={80}
      className={`${className} object-contain`}
      priority
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/aquastats-mark.png"
        alt=""
        width={40}
        height={40}
        className={compact ? "h-7 w-7 object-contain" : "h-8 w-8 object-contain"}
        priority
      />
      <span className={`font-semibold tracking-tight text-aqua ${compact ? "text-[15px]" : "text-lg"}`}>
        Aquastats
      </span>
    </span>
  );
}

export function BrandLockupFull({ className = "h-28 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/aquastats-logo.png"
      alt="Aquastats"
      width={320}
      height={314}
      className={`${className} object-contain object-left`}
      priority
    />
  );
}
