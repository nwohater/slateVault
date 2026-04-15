interface IconProps {
  className?: string;
}

interface ShieldProps extends IconProps {
  strokeWidth?: number;
  children?: React.ReactNode;
}

const shieldPath =
  "M12 2.5c2.689 1.948 5.74 3.052 9 3.25v5.5c0 5.301-3.029 9.242-9 11.25-5.971-2.008-9-5.949-9-11.25v-5.5c3.26-.198 6.311-1.302 9-3.25Z";

function ShieldFrame({
  className = "w-3.5 h-3.5",
  strokeWidth = 1.6,
  children,
}: ShieldProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={shieldPath} />
      {children}
    </svg>
  );
}

function ShieldDot({ cx, cy, r = 0.85 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
}

// Tree icons
export function ChevronRight({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ChevronDown({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function HomeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 4-3.25L16 12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.75V16h6v-4.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 16v-2.25h1.5V16" />
    </ShieldFrame>
  );
}

export function FilesIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25h4l2 2.25v5.25H9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 8.25v2.25h2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 13h4M10 15.25h3" />
    </ShieldFrame>
  );
}

export function SessionIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.75v3.5M10.25 9.5h3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 14.75h6.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17.25h4" />
      <ShieldDot cx={8.5} cy={9} r={0.7} />
      <ShieldDot cx={15.5} cy={9} r={0.7} />
    </ShieldFrame>
  );
}

export function AgentIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <rect x="8.2" y="8.4" width="7.6" height="6.4" rx="1.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 16.5v1h4v-1M12 6.75v1.65" />
      <ShieldDot cx={10.75} cy={11.65} r={0.75} />
      <ShieldDot cx={13.25} cy={11.65} r={0.75} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.75 13.8h2.5" />
    </ShieldFrame>
  );
}

export function DocsHealthIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 14.5h1.75L11.4 10l1.75 7 1.35-3h1.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.75h7.5" />
    </ShieldFrame>
  );
}

export function AiSparkIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 7.5.8 2.15 2.2.85-2.2.85-.8 2.15-.8-2.15-2.2-.85 2.2-.85L12 7.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 15.25h6.5" />
      <ShieldDot cx={9.25} cy={7.75} r={0.55} />
      <ShieldDot cx={15.1} cy={14.65} r={0.55} />
    </ShieldFrame>
  );
}

export function SettingsIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <circle cx="12" cy="12" r="2.1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v1.1M12 14.9V16M8 12h1.1M14.9 12H16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.15 9.15.8.8m3.9 3.9.8.8m0-5.5-.8.8m-3.9 3.9-.8.8" />
    </ShieldFrame>
  );
}

export function FileIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.1 7.9h3.3l1.8 2.05v6.1H9.1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.4 7.9v2.05h1.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 12.6h3.2M10 14.6h2.3" />
    </ShieldFrame>
  );
}

export function FolderIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.2 9.5h2.45l1.1 1.25h4.05v4.75H8.2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.2 10.75h7.6" />
    </ShieldFrame>
  );
}

export function FolderOpenIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.3 9.6h2.2l1 1.1h4.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.3 11.2h7.55l-1.05 3.6H9.15z" />
    </ShieldFrame>
  );
}

// Git status icons
export function GitAddedIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.75v6.5M8.75 12h6.5" />
    </ShieldFrame>
  );
}

export function GitModifiedIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.2v2.05l1.45 1.1" />
    </ShieldFrame>
  );
}

export function GitDeletedIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 12h6.5" />
    </ShieldFrame>
  );
}

export function GitUntrackedIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 9.5a1.75 1.75 0 1 1 2.45 1.6c-.9.35-1.45.9-1.45 1.65" />
      <ShieldDot cx={12} cy={15.65} r={0.8} />
    </ShieldFrame>
  );
}

// Action icons
export function StageIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
    </ShieldFrame>
  );
}

export function UnstageIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" />
    </ShieldFrame>
  );
}

export function CloseIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6 6m0-6-6 6" />
    </ShieldFrame>
  );
}

export function TrashIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 9.25h5.5M10 9.25v6m4-6v6M10.2 8.1l.45-.85h2.7l.45.85" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.65 9.25v6.4c0 .44.36.8.8.8h3.1c.44 0 .8-.36.8-.8v-6.4" />
    </ShieldFrame>
  );
}

export function BranchIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 8.25v7.5M10 9.1a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm0 7a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm0-3.6h3.8a1.1 1.1 0 1 0 0-2.2" />
    </ShieldFrame>
  );
}

// Tab icons
export function ChangesIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 8.2h3.25l1.7 1.9v5.7h-4.95z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 8.2v1.9h1.7M11.75 11.75v2.9M10.3 13.2h2.9" />
    </ShieldFrame>
  );
}

export function HistoryIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <circle cx="12" cy="12" r="3.4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.25v2.15l1.75 1.1M8.7 9.1 7.85 8.2" />
    </ShieldFrame>
  );
}

export function RemoteIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 13.8a5.5 5.5 0 0 1 7.5 0M9.85 11.55a3.25 3.25 0 0 1 4.3 0" />
      <ShieldDot cx={12} cy={15.7} r={0.8} />
    </ShieldFrame>
  );
}

export function PrIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <ShieldFrame className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.2 9.1v5.8M9.2 9.1a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm5.6 8a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm0-8a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM9.2 11.9h4.5M14.8 9.1v5.8" />
    </ShieldFrame>
  );
}
