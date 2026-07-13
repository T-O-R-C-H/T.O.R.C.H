interface TorchOrbProps {
  isActive?: boolean
  size?: number
}

export function TorchOrb({ isActive = false, size = 48 }: TorchOrbProps): JSX.Element {
  const ringSize = size + 20

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: ringSize + 40, height: ringSize + 40 }}
    >
      {/* Pulsing rings */}
      {isActive && (
        <>
          <div
            className="absolute border border-[#333] orb-ring orb-ring-1"
            style={{ width: ringSize + 32, height: ringSize + 32 }}
          />
          <div
            className="absolute border border-[#222] orb-ring orb-ring-2"
            style={{ width: ringSize + 20, height: ringSize + 20 }}
          />
          <div
            className="absolute border border-[#1c1c1c] orb-ring orb-ring-3"
            style={{ width: ringSize + 8, height: ringSize + 8 }}
          />
        </>
      )}

      {/* Center orb with torch */}
      <div
        className="relative flex items-center justify-center border border-[#2a2a2a] bg-[#060606]"
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.65}
          viewBox="0 0 28 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="10" y="20" width="8" height="16" fill="#ffffff" opacity="0.9" />
          <rect x="11" y="21" width="6" height="14" fill="#1c1c1c" />
          <rect x="12" y="22" width="4" height="12" fill="#2a2a2a" />
          <ellipse
            cx="14"
            cy="12"
            rx="10"
            ry="13"
            fill="#ffffff"
            className="torch-flame"
            opacity="0.95"
          />
          <ellipse cx="14" cy="13" rx="6" ry="9" fill="#000000" />
          <ellipse cx="14" cy="14" rx="3" ry="5" fill="#ffffff" opacity="0.95" />
        </svg>
      </div>
    </div>
  )
}
