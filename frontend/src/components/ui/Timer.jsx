function fmt(s) {
  return [Math.floor(s / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export default function Timer({ remaining }) {
  return (
    <div className={`timer ${remaining <= 10 ? 'urgent' : ''}`}>
      {fmt(remaining)}
    </div>
  );
}
