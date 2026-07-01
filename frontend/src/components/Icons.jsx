const baseProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export function BrandMark(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="5" />
      <path d="M7 14c1.4-1.6 2.8-2.4 4.3-2.4S14.4 12.4 16 14" />
      <path d="M8.5 9.5h.01" />
      <path d="M15.5 9.5h.01" />
      <path d="M12 16.5v.01" />
    </svg>
  );
}

export function SidebarToggleIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="4" />
      <path d="M10 5v14" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function MicrophoneIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v4" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function SendIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 12 20 4l-4 16-3.5-5.5L4 12Z" />
      <path d="M12.5 14.5 20 4" />
    </svg>
  );
}

export function UploadIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 16V5" />
      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
      <path d="M4 17.5v.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-.5" />
    </svg>
  );
}

export function FileAudioIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M10 13v4" />
      <path d="M13 11v8" />
      <path d="M16 14v2" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 1.5" />
    </svg>
  );
}

export function MoonIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z" />
    </svg>
  );
}

export function SunIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function ClipboardIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5Z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

export function ShieldIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 5.5 6v5c0 4.3 2.8 7.8 6.5 9 3.7-1.2 6.5-4.7 6.5-9V6Z" />
      <path d="m9.5 12 1.6 1.6 3.4-3.6" />
    </svg>
  );
}

export function SettingsIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2" />
      <path d="M14 12H4" />
      <path d="m8 8-4 4 4 4" />
    </svg>
  );
}

export function EyeIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function EyeOffIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m3 3 18 18" />
      <path d="M10.7 6.2A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a16.7 16.7 0 0 1-3.5 4.2" />
      <path d="M6.1 6.9C3.9 8.5 2.5 12 2.5 12s3.5 6 9.5 6c1 0 2-.2 2.9-.5" />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" />
    </svg>
  );
}
