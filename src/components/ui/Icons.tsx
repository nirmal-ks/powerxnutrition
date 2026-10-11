// Tiny inline icon set (no icon library = smaller bundle).
type P = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const CartIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>
);
export const SearchIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const MenuIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const PlusIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M5 12h14" /></svg>
);
export const TrashIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const ArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ShieldIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const TruckIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
);
export const BoltIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const StarIcon = ({ size, ...p }: P) => (
  <svg {...base(size, { fill: "currentColor", stroke: "none", ...p })}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
);
export const PhoneIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
);
export const MailIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);
export const PinIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const ClockIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="m5 12 5 5L20 7" /></svg>
);
export const CopyIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
);
export const FilterIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M4 5h16l-6 8v5l-4 2v-7z" /></svg>
);
export const TagIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
);
export const HomeIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>
);
export const GridIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const BoxIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="m3 7 9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></svg>
);
export const DumbbellIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" /></svg>
);
export const WhatsAppIcon = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2m0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3" />
  </svg>
);
export const InstagramIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
);
export const YoutubeIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)}><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></svg>
);
