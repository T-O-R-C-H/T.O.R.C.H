import { motion } from 'framer-motion'
import logoSrc from '@resources/logo.png'
import { WalkingCat } from './WalkingCat'

interface TorchBootAnimationProps {
  width?: number
}

const TRAVEL = {
  duration: 3,
  repeat: Infinity,
  repeatDelay: 0.8,
  ease: [0.33, 0.0, 0.2, 1] as const
}

const REVEAL = {
  duration: 3,
  repeat: Infinity,
  repeatDelay: 0.8,
  ease: [0.22, 1, 0.36, 1] as const
}

export function TorchBootAnimation({ width = 160 }: TorchBootAnimationProps): JSX.Element {
  const catTravel = width + 48

  return (
    <div className="torch-boot" style={{ width }}>
      <motion.div
        className="torch-boot__glow"
        animate={{ opacity: [0.25, 0.65, 0.25], scale: [0.97, 1.03, 0.97] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
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
            initial={{ clipPath: 'inset(0 100% 0 0 round 2px)' }}
            animate={{
              clipPath: [
                'inset(0 100% 0 0 round 2px)',
                'inset(0 0% 0 0 round 2px)',
                'inset(0 0% 0 0 round 2px)'
              ]
            }}
            transition={REVEAL}
          >
            <img src={logoSrc} alt="TORCH" className="torch-boot__logo-img" style={{ width }} />
          </motion.div>

          <motion.div
            className="torch-boot__shine"
            animate={{ x: [-40, width + 20], opacity: [0, 0.6, 0] }}
            transition={{ ...TRAVEL, opacity: { times: [0, 0.5, 1] } }}
          />
        </div>

        <motion.div
          className="torch-boot__spark-trail"
          animate={{ x: [-12, catTravel - 20] }}
          transition={TRAVEL}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="torch-boot__spark-dot"
              animate={{
                scale: [0.5, 1.2, 0.4],
                opacity: [0.3, 1, 0.2]
              }}
              transition={{
                duration: 0.35,
                repeat: Infinity,
                delay: i * 0.08,
                ease: 'easeInOut'
              }}
              style={{ left: i * 10 }}
            />
          ))}
        </motion.div>

        <motion.div
          className="torch-boot__cat"
          animate={{ x: [-44, width - 28] }}
          transition={{
            ...TRAVEL,
            type: 'tween'
          }}
        >
          <motion.div
            animate={{ rotate: [0, 1.5, 0, -1, 0] }}
            transition={{
              duration: 0.64,
              repeat: Infinity,
              type: 'spring',
              stiffness: 80,
              damping: 12
            }}
          >
            <WalkingCat />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
