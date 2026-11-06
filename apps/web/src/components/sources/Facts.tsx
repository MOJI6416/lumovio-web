/**
 * The facts of a release or a copy (7.9, 7.15 details), read and not chosen: the fact's name and its value side by side
 * from `sm`, as on a TV, so the list stays short; on a phone one under the other.
 */
export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-4 sm:grid sm:grid-cols-[auto_1fr] sm:gap-x-6 sm:gap-y-3">
      {rows.map(([k, v]) => (
        <div key={k} className="sm:contents">
          <dt className="text-body-s text-text-2 sm:text-body">{k}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-body text-text-1 sm:mt-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
