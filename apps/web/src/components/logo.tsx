import Image from "next/image";

export function Logo({ className = "h-14 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/catchup-logo.png"
      alt="CatchUp"
      width={1254}
      height={1254}
      preload
      className={`object-contain ${className}`}
    />
  );
}
