interface StatusBarProps {
  kind?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
}

export function StatusBar({ kind = "info", children }: StatusBarProps) {
  return <div className={`status status--${kind}`}>{children}</div>;
}
