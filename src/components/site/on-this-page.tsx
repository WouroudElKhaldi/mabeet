/**
 * The parts of a long reading page, as links to their headings: a row of chips on phones, and a list that stays in
 * view beside the text from `lg` up.
 */
export function OnThisPage({ label, links }: { label: string; links: Array<{ id: string; title: string }> }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-24 lg:h-fit">
      <p className="mb-3 text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">{label}</p>
      <ul className="flex flex-wrap gap-2 lg:grid lg:gap-1">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className="nav-link relative inline-block rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line lg:ps-0 lg:ring-0"
            >
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
