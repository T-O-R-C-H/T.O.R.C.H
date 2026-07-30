import { Composition } from 'remotion'
import { TorchPromo } from './TorchPromo'

export const RemotionRoot = (): JSX.Element => {
  return (
    <Composition
      id="TorchPromo"
      component={TorchPromo}
      durationInFrames={510}
      fps={30}
      width={1280}
      height={720}
    />
  )
}
