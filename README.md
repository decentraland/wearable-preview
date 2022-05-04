# Wearable Preview

This webapp renders an interactive 3D preview of a wearable or an avatar. It can be configured via query params or via `postMessage`:

- `contract`: The contract address of the wearable collection.
- `item`: The id of the item in the collection.
- `token`: The id of the token (to preview a specific NFT).
- `profile`: an ethereum address of a profile to load as the base avatar. It can be set to `default` to use a default profile.
- `urn`: a URN of a wearable to load. It will override anything loaded from a profile. It can be used many times.
- `url`: a URL of a wearable to load. It will override anything loaded from a profile. It can be used many times. The url will be fetched and must return a valid wearable following the [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) type.
- `base64`: a wearable to load, encoded in base64. It will override anything loaded from a profile. It can be used many times. Once parsed it should be a valid wearable following the [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) type.
- `skin`: a color to be used by the skin material, it must be in hex.
- `hair`: a color to be used by the hair material, it must be in hex.
- `eyes`: a color to be used by the eyes tint, it must be in hex.
- `bodyShape`: which body shape to use, possible values are `urn:decentraland:off-chain:base-avatars:BaseMale` or `urn:decentraland:off-chain:base-avatars:BaseFemale`.
- `emote`: the emote that the avatar will play. Default value is `idle`, other possible values are: `clap`, `dab`, `dance`, `fashion`, `fashion-2`, `fashion-3`,`fashion-4`, `love`, `money`, `fist-pump` and `head-explode`.
- `zoom`: the level of zoom, it must be a number between 1 and 100.
- `camera`: which camera type to use, either `interactive` or `static`. By default it uses the `interactive` one.
- `autoRotateSpeed`: the speed of the auto-rotate behavior of the camera. By default it is `0.2`, and it only works when the camera is not `static`.
- `centerBoundingBox`: wheter to center or not the camera around the bounding box of the avatar/wearable. By default is `true`.
- `offsetX`: apply an offset in the X position of the camera. By default is `0`.
- `offsetY`: apply an offset in the Y position of the camera. By default is `0`.
- `offsetZ`: apply an offset in the Z position of the camera. By default is `0`.
- `transparentBackground`: if set it will make the background transparent.
- `env`: The environment to use, it can be `prod` (uses mainnet wearables and catalysts) or `dev` (uses testnet wearables and catalysts).

Example: https://wearable-preview.decentraland.org?contract=0xee8ae4c668edd43b34b98934d6d2ff82e41e6488&item=5

### `iframe` API:

It's possible to load the `wearable-preview` in an iframe and communicate with it via `postMessage`:

#### Update/override options

If you want to update some options without having to reload the iframe, you can send an `update` message with the options and their new values:

```ts
import { PreviewMessageType, sendMessage } from '@dcl/schemas'

sendMessage(iframe.contentWindow, PreviewMessageType.UPDATE, {
  options: {
    emote: 'dab',
  },
})
```

### `iframe` events:

You can listen to events sent by the iframe via `postMessage`.

```ts
import { PreviewMessageType, PreviewMessagePayload } from '@dcl/schemas'

function handleMessage(event) {
  switch (event.data.type) {
    case PreviewMessageType.LOAD: {
      console.log('Preview loaded successfully')
      break
    }
    case PreviewMessageType.ERROR: {
      const { message } = event.data.payload as PreviewMessagePayload<PreviewMessageType.ERROR>
      console.error('Something went wrong:', message)
    }
  }
}

window.addEventListener('message', handleMessage)
```

### Setup

```
npm ci
```

### Development

```
npm run start
```

### Build

```
npm run build
```
