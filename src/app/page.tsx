import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const home = await getTranslations("home");
  const footer = await getTranslations("footer");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-4">
      <h1 className="text-3xl font-semibold">{home.rich("title", { em: (chunks) => <em>{chunks}</em> })}</h1>
      <p>{footer("about")}</p>
    </main>
  );
}
