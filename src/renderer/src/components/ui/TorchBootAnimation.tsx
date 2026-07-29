import { motion } from 'framer-motion'
import logoSrc from '@resources/logo.png'

function WalkingCat(): JSX.Element {
  const legTransition = {
    duration: 0.28,
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: 'easeInOut' as const
  }

  return (
    <motion.svg
      width="72"
      height="44"
      viewBox="0 0 72 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      animate={{ y: [0, -2.5, 0, -1.5, 0] }}
      transition={{ duration: 0.56, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ellipse cx="36" cy="40" rx="22" ry="3" fill="rgba(0,0,0,0.08)" />

      <motion.path
        d="M58 18 C62 14 64 10 62 6 C60 8 58 12 56 16"
        stroke="#8B6914"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        animate={{ rotate: [-8, 14, -8] }}
        transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '56px', originY: '16px' }}
      />

      <ellipse cx="38" cy="24" rx="20" ry="11" fill="url(#catBody)" />
      <ellipse cx="52" cy="20" rx="9" ry="8" fill="url(#catBody)" />
      <path d="M46 14 L48 8 L50 14 Z" fill="#3D2914" />
      <path d="M52 13 L54 7 L56 13 Z" fill="#3D2914" />
      <circle cx="54" cy="18" r="1.2" fill="#1a1a1a" />
      <circle cx="54.4" cy="17.6" r="0.35" fill="#fff" />
      <path d="M57 19 Q59 19 58 20" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path
        d="M18 22 Q24 20 30 22 Q24 24 18 22"
        fill="none"
        stroke="#6B4E1A"
        strokeWidth="0.6"
        opacity="0.5"
      />

      <motion.g
        animate={{ rotate: [-22, 18] }}
        transition={legTransition}
        style={{ originX: '44px', originY: '32px' }}
      >
        <rect x="42" y="30" width="3" height="9" rx="1.5" fill="#4A3728" />
      </motion.g>
      <motion.g
        animate={{ rotate: [18, -22] }}
        transition={legTransition}
        style={{ originX: '50px', originY: '32px' }}
      >
        <rect x="48" y="30" width="3" height="9" rx="1.5" fill="#3D2914" />
      </motion.g>
      <motion.g
        animate={{ rotate: [18, -22] }}
        transition={{ ...legTransition, delay: 0.14 }}
        style={{ originX: '28px', originY: '32px' }}
      >
        <rect x="26" y="30" width="3" height="9" rx="1.5" fill="#3D2914" />
      </motion.g>
      <motion.g
        animate={{ rotate: [-22, 18] }}
        transition={{ ...legTransition, delay: 0.14 }}
        style={{ originX: '34px', originY: '32px' }}
      >
        <rect x="32" y="30" width="3" height="9" rx="1.5" fill="#4A3728" />
      </motion.g>

      <motion.circle
        cx="14"
        cy="22"
        r="3"
        fill="#FFD166"
        animate={{ scale: [0.6, 1.1, 0.6], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.35, repeat: Infinity }}
      />
      <motion.circle
        cx="10"
        cy="20"
        r="1.5"
        fill="#60A5FA"
        animate={{ scale: [0, 1, 0], opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.35, repeat: Infinity, delay: 0.08 }}
      />

      <defs>
        <linearGradient id="catBody" x1="20" y1="14" x2="56" y2="34">
          <stop offset="0%" stopColor="#C4956A" />
          <stop offset="45%" stopColor="#A67B4E" />
          <stop offset="100%" stopColor="#7A5C3A" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

interface TorchBootAnimationProps {
  width?: number
}

const LOOP = {
  duration: 2.6,
  repeat: Infinity,
  repeatDelay: 1,
  ease: [0.45, 0.05, 0.55, 0.95] as const
}

export function TorchBootAnimation({ width = 160 }: TorchBootAnimationProps): JSX.Element {
  return (
    <div className="torch-boot" style={{ width }}>
      <motion.div
        className="torch-boot__glow"
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="torch-boot__track">
        <div className="torch-boot__logo-stack">
          <img
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className="torch-boot__logo-img torch-boot__logo-img--ghost"
            style={{ width }}
          />
          <motion.div
            className="torch-boot__logo-reveal"
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 0)'] }}
            transition={{ ...LOOP, ease: [0.22, 1, 0.36, 1] }}
          >
            <img src={logoSrc} alt="TORCH" className="torch-boot__logo-img" style={{ width }} />
          </motion.div>
        </div>

        <motion.div className="torch-boot__spark" animate={{ x: [-8, width + 8] }} transition={LOOP} />

        <motion.div className="torch-boot__cat" animate={{ x: [-36, width - 24] }} transition={LOOP}>
          <WalkingCat />
        </motion.div>
      </div>
    </div>
  )
}
