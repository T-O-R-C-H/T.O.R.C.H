import { 
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiCheckboxBlankCircleLine,
  RiAlertLine,
  RiShieldCheckLine,
  RiUserLine,
  RiFireLine,
  RiGlobalLine,
  RiMailLine,
  RiFileTextLine,
  RiSendPlane2Line,
  RiSparkling2Line,
  RiSearchLine,
  RiFolderLine,
  RiChat3Line,
  RiComputerLine,
  RiEyeLine,
  RiEyeOffLine,
  RiHistoryLine,
  RiPieChartLine,
  RiStockLine,
  RiTargetLine,
  RiMentalHealthLine,
  RiListCheck,
  RiKeyLine,
  RiMicLine,
  RiPaletteLine,
  RiShutDownLine,
  RiDatabase2Line,
  RiExternalLinkLine,
  RiSettings4Line,
  RiArrowRightLine,
  RiArrowLeftLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCommandLine,
  RiWindowLine,
  RiShareForwardLine
} from 'react-icons/ri'

/**
 * TORCH Icon System — React Icons (Remix Icon)
 * Pure, sleek, and consistent.
 */

interface IconProps {
  size?: number
  className?: string
}

export const IconCheck = ({ size = 16, className }: IconProps) => <RiCheckLine size={size} className={className} />
export const IconX = ({ size = 16, className }: IconProps) => <RiCloseLine size={size} className={className} />
export const IconLoader = ({ size = 16, className }: IconProps) => <RiLoader4Line size={size} className={`spinner ${className || ''}`} />
export const IconCircle = ({ size = 16, className }: IconProps) => <RiCheckboxBlankCircleLine size={size} className={className} />
export const IconAlertTriangle = ({ size = 16, className }: IconProps) => <RiAlertLine size={size} className={className} />
export const IconShield = ({ size = 16, className }: IconProps) => <RiShieldCheckLine size={size} className={className} />
export const IconUser = ({ size = 16, className }: IconProps) => <RiUserLine size={size} className={className} />
export const IconFlame = ({ size = 16, className }: IconProps) => <RiFireLine size={size} className={className} />
export const IconGlobe = ({ size = 16, className }: IconProps) => <RiGlobalLine size={size} className={className} />
export const IconMail = ({ size = 16, className }: IconProps) => <RiMailLine size={size} className={className} />
export const IconFile = ({ size = 16, className }: IconProps) => <RiFileTextLine size={size} className={className} />
export const IconSend = ({ size = 16, className }: IconProps) => <RiSendPlane2Line size={size} className={className} />
export const IconSparkles = ({ size = 16, className }: IconProps) => <RiSparkling2Line size={size} className={className} />
export const IconSearch = ({ size = 16, className }: IconProps) => <RiSearchLine size={size} className={className} />
export const IconFolder = ({ size = 16, className }: IconProps) => <RiFolderLine size={size} className={className} />
export const IconMessage = ({ size = 16, className }: IconProps) => <RiChat3Line size={size} className={className} />
export const IconMonitor = ({ size = 16, className }: IconProps) => <RiComputerLine size={size} className={className} />
export const IconEye = ({ size = 16, className }: IconProps) => <RiEyeLine size={size} className={className} />
export const IconEyeOff = ({ size = 16, className }: IconProps) => <RiEyeOffLine size={size} className={className} />
export const IconClock = ({ size = 16, className }: IconProps) => <RiHistoryLine size={size} className={className} />
export const IconChart = ({ size = 16, className }: IconProps) => <RiPieChartLine size={size} className={className} />
export const IconTrendingUp = ({ size = 16, className }: IconProps) => <RiStockLine size={size} className={className} />
export const IconTarget = ({ size = 16, className }: IconProps) => <RiTargetLine size={size} className={className} />
export const IconBrain = ({ size = 16, className }: IconProps) => <RiMentalHealthLine size={size} className={className} />
export const IconList = ({ size = 16, className }: IconProps) => <RiListCheck size={size} className={className} />
export const IconKey = ({ size = 16, className }: IconProps) => <RiKeyLine size={size} className={className} />
export const IconMic = ({ size = 16, className }: IconProps) => <RiMicLine size={size} className={className} />
export const IconPalette = ({ size = 16, className }: IconProps) => <RiPaletteLine size={size} className={className} />
export const IconPower = ({ size = 16, className }: IconProps) => <RiShutDownLine size={size} className={className} />
export const IconDatabase = ({ size = 16, className }: IconProps) => <RiDatabase2Line size={size} className={className} />
export const IconExternalLink = ({ size = 16, className }: IconProps) => <RiExternalLinkLine size={size} className={className} />
export const IconSettings = ({ size = 16, className }: IconProps) => <RiSettings4Line size={size} className={className} />
export const IconArrowRight = ({ size = 16, className }: IconProps) => <RiArrowRightLine size={size} className={className} />
export const IconArrowLeft = ({ size = 16, className }: IconProps) => <RiArrowLeftLine size={size} className={className} />
export const IconChevronDown = ({ size = 16, className }: IconProps) => <RiArrowDownSLine size={size} className={className} />
export const IconChevronUp = ({ size = 16, className }: IconProps) => <RiArrowUpSLine size={size} className={className} />
export const IconCommand = ({ size = 16, className }: IconProps) => <RiCommandLine size={size} className={className} />
export const IconBrowser = ({ size = 16, className }: IconProps) => <RiWindowLine size={size} className={className} />
export const IconShare = ({ size = 16, className }: IconProps) => <RiShareForwardLine size={size} className={className} />
