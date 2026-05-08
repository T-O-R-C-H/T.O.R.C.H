export function WaveStrip(): JSX.Element {
  return (
    <div className="flex items-end justify-center gap-[3px] h-[32px]">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="wave-bar w-[3px] bg-white"
        />
      ))}
    </div>
  )
}
