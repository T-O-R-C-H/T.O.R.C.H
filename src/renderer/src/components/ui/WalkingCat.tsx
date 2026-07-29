import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useId } from 'react'

const WALK_BEAT = 0.32

const legSwing = {
  duration: WALK_BEAT,
  repeat: Infinity,
  ease: [0.45, 0, 0.55, 1] as const
}

const bodyBob = {
  duration: WALK_BEAT * 2,
  repeat: Infinity,
  ease: 'easeInOut' as const
}

interface WalkingCatProps {
  polish?: boolean
}

export function WalkingCat({ polish = true }: WalkingCatProps): JSX.Element {
  const uid = useId().replace(/:/g, '')
  const lidCtrl = useAnimationControls()

  useEffect(() => {
    let cancelled = false
    const loop = async (): Promise<void> => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2500))
        if (cancelled) break
        await lidCtrl.start({
          scaleY: [0, 1, 1, 0],
          transition: { duration: 0.18, times: [0, 0.15, 0.55, 1], ease: 'easeInOut' }
        })
      }
    }
    void loop()
    return (): void => {
      cancelled = true
    }
  }, [lidCtrl])

  return (
    <motion.svg
      width="108"
      height="64"
      viewBox="0 0 108 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="walking-cat"
    >
      <defs>
        <linearGradient id={`${uid}-fur`} x1="8" y1="8" x2="88" y2="52">
          <stop offset="0%" stopColor="#D4A574" />
          <stop offset="38%" stopColor="#B8895A" />
          <stop offset="100%" stopColor="#8B6340" />
        </linearGradient>
        <linearGradient id={`${uid}-belly`} x1="30" y1="30" x2="70" y2="46">
          <stop offset="0%" stopColor="#E8C9A0" />
          <stop offset="100%" stopColor="#C99B6E" />
        </linearGradient>
        <linearGradient id={`${uid}-ear`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0B8B0" />
          <stop offset="100%" stopColor="#D49088" />
        </linearGradient>
        <radialGradient id={`${uid}-eye`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#6BB8FF" />
          <stop offset="55%" stopColor="#3D8FD9" />
          <stop offset="100%" stopColor="#1E5F99" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodOpacity="0.2" />
        </filter>
      </defs>

      <motion.ellipse
        cx="52"
        cy="58"
        rx="34"
        ry="4.5"
        fill="rgba(0,0,0,0.1)"
        animate={{ rx: [34, 29, 34, 30, 34], opacity: [0.11, 0.06, 0.11, 0.07, 0.11] }}
        transition={bodyBob}
      />

      <motion.g animate={{ y: [0, -3.5, 0, -2.2, 0] }} transition={bodyBob} filter={`url(#${uid}-soft)`}>
        <motion.path
          d="M14 28 C4 22 0 14 6 8 C10 12 12 20 18 26"
          stroke="#9A7048"
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
          animate={{ rotate: [-8, 14, -5, 12, -8] }}
          transition={{ duration: 0.52, repeat: Infinity, type: 'spring', stiffness: 110, damping: 9 }}
          style={{ originX: '18px', originY: '26px' }}
        />

        <motion.g
          animate={{ rotate: [30, -16, 30] }}
          transition={{ ...legSwing, delay: WALK_BEAT }}
          style={{ originX: '34px', originY: '42px' }}
        >
          <path d="M34 42 L32 52 L30 56" stroke="#6B4E32" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="30" cy="57" rx="3.5" ry="2.2" fill="#3D2914" />
        </motion.g>
        <motion.g
          animate={{ rotate: [-16, 30, -16] }}
          transition={legSwing}
          style={{ originX: '42px', originY: '42px' }}
        >
          <path d="M42 42 L44 52 L46 56" stroke="#5C4228" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="46" cy="57" rx="3.5" ry="2.2" fill="#3D2914" />
        </motion.g>

        <ellipse cx="48" cy="36" rx="30" ry="13" fill={`url(#${uid}-fur)`} />
        <ellipse cx="44" cy="40" rx="18" ry="8" fill={`url(#${uid}-belly)`} opacity="0.85" />
        <path
          d="M28 30 Q32 28 36 30 M24 34 Q30 32 36 34 M30 38 Q36 36 42 38"
          stroke="#7A5638"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.45"
        />

        <motion.g
          animate={{ rotate: [-18, 28, -18] }}
          transition={legSwing}
          style={{ originX: '62px', originY: '42px' }}
        >
          <path d="M62 42 L64 52 L66 56" stroke="#5C4228" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="66" cy="57" rx="3.5" ry="2.2" fill="#3D2914" />
        </motion.g>
        <motion.g
          animate={{ rotate: [28, -18, 28] }}
          transition={{ ...legSwing, delay: WALK_BEAT }}
          style={{ originX: '72px', originY: '42px' }}
        >
          <path d="M72 42 L74 52 L76 56" stroke="#6B4E32" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="76" cy="57" rx="3.5" ry="2.2" fill="#3D2914" />
        </motion.g>

        <ellipse cx="78" cy="32" rx="5" ry="7" fill={`url(#${uid}-fur)`} />
        <ellipse cx="86" cy="30" rx="13" ry="11.5" fill={`url(#${uid}-fur)`} />
        <ellipse cx="83" cy="36" rx="7" ry="5" fill={`url(#${uid}-belly)`} opacity="0.7" />

        <path d="M76 20 L78 10 L82 20 Z" fill={`url(#${uid}-fur)`} />
        <path d="M77 19 L78.5 13 L80.5 19 Z" fill={`url(#${uid}-ear)`} />
        <path d="M84 19 L87 9 L90 19 Z" fill={`url(#${uid}-fur)`} />
        <path d="M85.5 18 L87 12 L88.5 18 Z" fill={`url(#${uid}-ear)`} />

        <g>
          <ellipse cx="91" cy="28" rx="3.8" ry="4.2" fill="#fff" />
          <ellipse cx="91" cy="28" rx="2.8" ry="3.2" fill={`url(#${uid}-eye)`} />
          <circle cx="92" cy="27" r="1" fill="#fff" opacity="0.95" />
          <motion.ellipse
            cx="91"
            cy="28"
            rx="4.2"
            ry="4.5"
            fill="#B8895A"
            animate={lidCtrl}
            initial={{ scaleY: 0 }}
            style={{ originX: '91px', originY: '28px' }}
          />
        </g>

        <path d="M96 30 L98 31.5 L96 33 Z" fill="#E8A090" />
        <path d="M97 33 Q98 34.5 97 35.5" stroke="#6B4E32" strokeWidth="0.8" fill="none" />
        <path d="M94 31 H88 M94 33 H87 M94 35 H88" stroke="#6B4E32" strokeWidth="0.5" opacity="0.5" />

        {polish && (
          <motion.g
            animate={{ rotate: [-10, 8, -10], y: [0, -1, 0] }}
            transition={{ duration: 0.26, repeat: Infinity, ease: 'easeInOut' }}
            style={{ originX: '98px', originY: '48px' }}
          >
            <path d="M96 44 L102 40 L104 44 L100 48 Z" fill="#60A5FA" opacity="0.95" />
            <rect x="100" y="37" width="9" height="3" rx="1" fill="#93C5FD" />
            {[0, 1, 2, 3].map((i) => (
              <motion.circle
                key={i}
                cx={105}
                cy={35}
                r={1.4}
                fill={i % 2 === 0 ? '#FFD166' : '#60A5FA'}
                animate={{
                  cx: [105, 112 + i * 4, 118 + i * 5],
                  cy: [35, 28 - i * 2, 32 - i],
                  opacity: [0, 0.95, 0],
                  scale: [0.3, 1.3, 0.1]
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1]
                }}
              />
            ))}
          </motion.g>
        )}
      </motion.g>
    </motion.svg>
  )
}
