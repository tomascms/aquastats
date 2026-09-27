import { getServerT } from "@/i18n/server";

export default async function Loading() {
  const t = await getServerT();
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <p className="text-sm text-mute">{t("A carregar…")}</p>
    </div>
  );
}
