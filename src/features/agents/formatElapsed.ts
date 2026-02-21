function formatElapsedSeconds(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins)}m ${String(secs)}s`;
}

function formatElapsedMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  return formatElapsedSeconds(totalSeconds);
}

export { formatElapsedSeconds, formatElapsedMs };
