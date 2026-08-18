import { Composition } from 'remotion'
import type { ReactElement } from 'react'
import { TorchPromo } from './TorchPromo'
import {
  TorchXAvatar,
  TorchXHeader,
  TorchXHeaderCentered,
  TorchXHeaderDark,
  TorchXHeaderFlow
} from './TorchSocial'

export const RemotionRoot = (): ReactElement => {
  return (
    <>
      <Composition
        id="TorchPromo"
        component={TorchPromo}
        durationInFrames={1680}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="TorchXHeader"
        component={TorchXHeader}
        durationInFrames={1}
        fps={30}
        width={1500}
        height={500}
      />
      <Composition
        id="TorchXAvatar"
        component={TorchXAvatar}
        durationInFrames={1}
        fps={30}
        width={400}
        height={400}
      />
      <Composition
        id="TorchXHeaderCentered"
        component={TorchXHeaderCentered}
        durationInFrames={1}
        fps={30}
        width={1500}
        height={500}
      />
      <Composition
        id="TorchXHeaderFlow"
        component={TorchXHeaderFlow}
        durationInFrames={1}
        fps={30}
        width={1500}
        height={500}
      />
      <Composition
        id="TorchXHeaderDark"
        component={TorchXHeaderDark}
        durationInFrames={1}
        fps={30}
        width={1500}
        height={500}
      />
    </>
  )
}
