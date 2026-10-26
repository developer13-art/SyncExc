import logoImage from '../logo.png';
import { cn } from '../../lib/utils/cn.util.js';

export default function LogoIcon({ className, ...props }) {
  return (
    <span
      className={cn('relative block shrink-0 overflow-hidden rounded-lg', className)}
      {...props}
    >
      <img
        src={logoImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-[2.35] object-cover"
      />
    </span>
  );
}
