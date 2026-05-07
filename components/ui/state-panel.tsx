import { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function StatePanel({ title, description, action }: StatePanelProps) {
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-8 shadow-glow">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
