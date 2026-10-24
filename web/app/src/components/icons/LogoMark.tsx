export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/raaga_logo_mark.png"
      alt="Raaga"
      className={`object-contain ${className || ''}`}
      style={{ width: size, height: 'auto', display: 'inline-block' }}
    />
  );
}
