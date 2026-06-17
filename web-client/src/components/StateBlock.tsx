export function LoadingBlock({ label }: { label: string }) {
  return <div className="state-block">{label}</div>;
}

export function EmptyBlock({ label }: { label: string }) {
  return <div className="state-block state-block-muted">{label}</div>;
}

export function ErrorBlock({ message }: { message: string }) {
  return <div className="state-block state-block-error">{message}</div>;
}
