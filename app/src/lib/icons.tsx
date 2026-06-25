import type { CSSProperties } from 'react';

interface IconProps { size?: number; sw?: number; style?: CSSProperties; }

function S({ size = 19, sw = 1.9, style, children, fill = 'none' }: IconProps & { children: React.ReactNode; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  );
}

// ── Navigation (exakt aus Prototyp) ──
export const IconDashboard = (p: IconProps) => <S {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></S>;
export const IconTarget = (p: IconProps) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></S>;
export const IconTraining = (p: IconProps) => <S {...p}><path d="M6.5 6.5 17.5 17.5M3 12l3-3 9 9 3-3M14.5 3.5 20.5 9.5M3.5 14.5 9.5 20.5" /></S>;
export const IconCalendar = (p: IconProps) => <S {...p}><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></S>;
export const IconTrophy = (p: IconProps) => <S {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.6V17c0 .5-.4 1-1 1.2C7.9 18.7 7 20.2 7 22M14 14.6V17c0 .5.4 1 1 1.2 1.1.5 2 2 2 4M18 2H6v7a6 6 0 0 0 12 0V2z" /></S>;
export const IconShield = (p: IconProps) => <S {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></S>;
export const IconUsers = (p: IconProps) => <S {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></S>;
export const IconBars = (p: IconProps) => <S {...p}><path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-9" /></S>;
export const IconUserCheck = (p: IconProps) => <S {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5" /></S>;
export const IconSettings = (p: IconProps) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></S>;
export const IconLogout = (p: IconProps) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></S>;

// ── Allgemein ──
export const IconPlus = (p: IconProps) => <S sw={2.6} {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconSearch = (p: IconProps) => <S sw={2} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></S>;
export const IconEdit = (p: IconProps) => <S sw={2} {...p}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></S>;
export const IconBack = (p: IconProps) => <S sw={2} {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></S>;
export const IconChevronRight = (p: IconProps) => <S sw={2} {...p}><path d="M9 18l6-6-6-6" /></S>;
export const IconChevronLeft = (p: IconProps) => <S sw={2} {...p}><path d="M15 18l-6-6 6-6" /></S>;
export const IconArrowRight = (p: IconProps) => <S sw={2} {...p}><path d="M5 12h14M12 5l7 7-7 7" /></S>;
export const IconCheck = (p: IconProps) => <S sw={2.4} {...p}><path d="M20 6 9 17l-5-5" /></S>;
export const IconX = (p: IconProps) => <S sw={2} {...p}><path d="M18 6 6 18M6 6l12 12" /></S>;
export const IconClock = (p: IconProps) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const IconSwap = (p: IconProps) => <S sw={2} {...p}><path d="M7 16V4M7 4 3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" /></S>;
export const IconTrash = (p: IconProps) => <S sw={2} {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></S>;
export const IconUndo = (p: IconProps) => <S sw={2} {...p}><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" /></S>;
export const IconRefresh = (p: IconProps) => <S sw={2} {...p}><path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></S>;
export const IconCalendarSmall = (p: IconProps) => <S sw={2} {...p}><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></S>;
export const IconUsersSmall = (p: IconProps) => <S sw={2} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></S>;

// ── Vereinslogo (Dartscheibe) ──
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="19" fill="#0f2419" stroke="#19A463" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="13.5" fill="#2a1110" stroke="#E04B43" strokeWidth="1" />
      <circle cx="20" cy="20" r="8" fill="#0f2419" stroke="#19A463" strokeWidth="1" />
      <circle cx="20" cy="20" r="4" fill="#F2B829" />
      <circle cx="20" cy="20" r="1.6" fill="#E04B43" />
    </svg>
  );
}

export function IconPath({ d, size = 18, sw = 1.9, style }: { d: string } & IconProps) {
  return <S size={size} sw={sw} style={style}><path d={d} /></S>;
}
