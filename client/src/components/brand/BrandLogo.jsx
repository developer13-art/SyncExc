import { cn } from '../../lib/utils/cn.util.js';
import logo from '../../assets/logo.png';

export function BrandLogo({ className, alt = '' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950',
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      <img
        src={logo}
        alt={alt}
        className="h-full w-full scale-[2.2] object-cover"
      />
    </span>
  );
}
