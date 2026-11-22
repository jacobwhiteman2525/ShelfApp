const SECTIONS = [
  ['popular', 'Popular'],
  ['new', 'New Releases'],
  ['upcoming', 'Upcoming'],
  ['top', 'Top Rated'],
];

const SORTS = {
  popular: ['-added', 'Popular on RAWG'],
  new: ['-released', 'Newest first'],
  upcoming: ['released', 'Soonest release first'],
  top: ['-rating', 'Highest RAWG community rating'],
  critic: ['-metacritic', 'Highest Metacritic critic score'],
};

const localDate = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');

function gameQuery({ section, sort, search, platform }, now = new Date()) {
  const today = localDate(now);
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), 1);
  const lastDay = new Date(nextYear.getFullYear(), nextYear.getMonth() + 1, 0).getDate();
  nextYear.setDate(Math.min(lastDay, now.getDate()));
  const recent = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
  const dates = section === 'upcoming' ? `${today},${localDate(nextYear)}`
    : section === 'new' ? `${localDate(recent)},${today}` : undefined;
  return {
    search: search.trim() || undefined,
    platforms: platform || undefined,
    ordering: SORTS[sort][0],
    dates,
  };
}

module.exports = { SECTIONS, SORTS, gameQuery };
