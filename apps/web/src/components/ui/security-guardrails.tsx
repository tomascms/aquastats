export function SecurityGuardrails() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-aqua">Exposição</p>
        <p className="mt-2 text-sm text-mist">
          Nenhum segredo está em URL, em query string, em página pública nem em ficheiros do repositório.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-aqua">Origem</p>
        <p className="mt-2 text-sm text-mist">
          O Worker e a API partilham um token secreto e a API recusa chamadas diretas sem esse header.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-aqua">Acesso</p>
        <p className="mt-2 text-sm text-mist">
          Endpoints não públicos devolvem 401, 403 ou 404; nada sensível aparece em links públicos nem em páginas de erro.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-aqua">Regra</p>
        <p className="mt-2 text-sm text-mist">
          Qualquer alteração futura tem de seguir esta base: segredo só em hosting, app origin validada e sem tokens em URLs.
        </p>
      </div>
    </div>
  );
}
