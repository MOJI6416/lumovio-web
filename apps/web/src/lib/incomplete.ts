/**
 * `refetchInterval` for a summary of a kids profile's own data (lists, ratings, statistics, liked titles): the first
 * look after a long break may be answered before every title's rating is checked, and then says `incomplete` (PRF-19).
 * The app asks again a second later, a few times at most; a complete answer stops it.
 */
export function untilComplete(query: { state: { data?: unknown; dataUpdateCount: number } }): number | false {
  const incomplete = (query.state.data as { incomplete?: boolean } | undefined)?.incomplete === true;
  return incomplete && query.state.dataUpdateCount < 6 ? 1000 : false;
}
