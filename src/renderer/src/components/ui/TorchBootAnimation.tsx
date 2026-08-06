import { motion } from 'framer-motion'
import { TorchLogo } from './TorchLogo'

interface TorchBootAnimationProps {
  width?: number
}

export function TorchBootAnimation({ width = 160 }: TorchBootAnimationProps): JSX.Element {
  return (
    <div className="torch-boot" style={{ width }}>
      <motion.div
        className="torch-boot__glow"
        animate={{ opacity: [0.25, 0.65, 0.25], scale: [0.97, 1.03, 0.97] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div animate={{ scale: [0.96, 1.04, 0.96] }} transition={{ duration: 1.5, repeat: Infinity }}>
        <TorchLogo size={width} />
      </motion.div>
    </div>
  )
}
