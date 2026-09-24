"use client";

function score(password: string): number {
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  return Math.min(points, 4);
}

const LABELS = ["Fraca", "Razoável", "Boa", "Forte", "Excelente"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const value = score(password);
  const label = LABELS[value];
  const width = `${((value + 1) / 5) * 100}%`;
  const color =
    value <= 1 ? "bg-coral" : value === 2 ? "bg-sand" : value === 3 ? "bg-aqua/70" : "bg-aqua";

  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width }} />
      </div>
      <p className="text-[11px] text-mute">
        Força: <span className="font-medium text-mist">{label}</span>
        {password.length < 8 ? " · mínimo 8, letras e números" : null}
      </p>
    </div>
  );
}
