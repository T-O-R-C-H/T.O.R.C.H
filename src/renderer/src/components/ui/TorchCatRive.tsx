import { Alignment, Fit, Layout, useRive } from '@rive-app/react-canvas'
import catLogoSrc from '@resources/cat_logo.riv?url'

interface TorchCatRiveProps {
  className?: string
  height?: number
}

export function TorchCatRive({ className, height = 128 }: TorchCatRiveProps): JSX.Element {
  const { RiveComponent } = useRive({
    src: catLogoSrc,
    stateMachines: 'State Machine 1',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center
    })
  })

  return (
    <div className={`torch-cat-rive ${className ?? ''}`.trim()} style={{ height, width: '100%' }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
