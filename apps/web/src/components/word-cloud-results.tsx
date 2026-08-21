type Entry = { id: string; text: string; votes: number; rank?: number };

const colors = [
  "text-teal-700",
  "text-cyan-700",
  "text-sky-700",
  "text-blue-700",
  "text-indigo-700",
  "text-violet-700",
];

export function wordCloudColor(text: string) {
  let hash = 0;
  for (const character of text.trim().toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export function wordCloudFontSize(
  votes: number,
  minVotes: number,
  maxVotes: number,
) {
  if (minVotes === maxVotes) return 48;
  return Math.round(22 + ((votes - minVotes) / (maxVotes - minVotes)) * 54);
}

export function WordCloudResults({
  entries,
  totalVotes,
  emptyLabel,
  votesLabel,
  totalVotesLabel,
  className = "",
}: {
  entries: Entry[];
  totalVotes: number;
  emptyLabel: string;
  votesLabel: string;
  totalVotesLabel: string;
  className?: string;
}) {
  const ranked = [...entries].sort(
    (a, b) => b.votes - a.votes || a.text.localeCompare(b.text),
  );
  const votes = ranked.map((entry) => entry.votes);
  const minVotes = Math.min(...votes);
  const maxVotes = Math.max(...votes);
  if (!ranked.length)
    return (
      <p className="py-16 text-center text-lg font-semibold text-neutral-500">
        {emptyLabel}
      </p>
    );
  return (
    <div className={className}>
      <p className="text-center font-semibold text-neutral-500">
        {totalVotesLabel}: {totalVotes}
      </p>
      <div className="mt-5 flex min-h-72 flex-wrap content-center justify-center gap-x-7 gap-y-5 overflow-hidden rounded-3xl bg-neutral-100 p-6 sm:min-h-96 sm:p-10">
        {ranked.map((entry) => (
          <span
            key={entry.id}
            style={{
              fontSize: `clamp(22px, calc(6vw + ${wordCloudFontSize(entry.votes, minVotes, maxVotes) / 2}px), ${wordCloudFontSize(entry.votes, minVotes, maxVotes)}px)`,
            }}
            className={`break-words text-center font-black leading-none ${wordCloudColor(entry.text)}`}
          >
            {entry.text}
          </span>
        ))}
      </div>
      <ol className="sr-only">
        {ranked.map((entry, index) => (
          <li key={entry.id}>
            {index + 1}. {entry.text}: {entry.votes} {votesLabel}
          </li>
        ))}
      </ol>
    </div>
  );
}
