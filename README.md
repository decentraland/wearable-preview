# Wearable Preview

This webapp renders an interactive 3D preview of a wearable or an avatar. It can be configured via query params or via `postMessage`:

- `contract`: The contract address of the wearable collection.
- `item`: The id of the item in the collection.
- `token`: The id of the token (to preview a specific NFT).
- `profile`: an ethereum address of a profile to load as the base avatar. It can be set to `default` to use a default profile.
- `urn`: a URN of a wearable or an emote to load. If it is a wearable, it will override anything loaded from a profile. It can be used many times.
- `url`: a URL of a wearable or an emote to load. If it is a wearable, it will override anything loaded from a profile. It can be used many times. The url will be fetched and must return a valid definition following the [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) or [`EmoteDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/emote-definition.ts) types.
- `base64`: a wearable or an emote to load, encoded in base64. If it is a wearable, it will override anything loaded from a profile. It can be used many times. Once parsed it should be a valid definition following the [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) or [`EmoteDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/emote-definition.ts) types.
- `skin`: a color to be used by the skin material, it must be in hex.
- `hair`: a color to be used by the hair material, it must be in hex.
- `eyes`: a color to be used by the eyes tint, it must be in hex.
- `bodyShape`: which body shape to use, possible values are `urn:decentraland:off-chain:base-avatars:BaseMale` or `urn:decentraland:off-chain:base-avatars:BaseFemale`.
- `emote`: the emote that the avatar will play. Default value is `idle`, other possible values are: `clap`, `dab`, `dance`, `fashion`, `fashion-2`, `fashion-3`,`fashion-4`, `love`, `money`, `fist-pump` and `head-explode`.
- `zoom`: the level of zoom, it must be a number between 1 and 100.
- `camera`: which camera type to use, either `interactive` or `static`. By default it uses the `interactive` one.
- `projection`: which projection type to use, either `orthographic` or `perspective`. By default it uses the `perspective` one.
- `offsetX`: apply an offset in the X position of the scene. By default is `0`.
- `offsetY`: apply an offset in the Y position of the scene. By default is `0`.
- `offsetZ`: apply an offset in the Z position of the scene. By default is `0`.
- `cameraX`: set the X position of the camera.
- `cameraY`: set the Y position of the camera.
- `cameraZ`: set the Z position of the camera.
- `wheelZoom`: a multiplier of how much the user can zoom with the mouse wheel. By default is `1`, which means the wheel doesn't do any zoom. If the value were `2` the user would be able to zoom up to 2x.
- `wheelPrecision`: the higher the value, the slower the wheel zooms when scrolled. By default is `100`.
- `wheelStart`: a value between 0 and 100 which determines how zoomed in or out the wheel starts. By default is `50`, so the user can zoom in or out. If the value were `0` the zoom would start at minimum and the user would be able to zoom in. If the value were `100` the zoom would start at max and the user would be able to zoom out.
- `background`: the color of the background in hex, ie: `ff0000`.
- `peerUrl`: set a custom url for a Catalyst peer.
- `nftServerUrl`: set a custom url for the NFT API.
- `type`: set a custom PreviewType to render standalone items passed as urn, url or base64. currently only supports `wearable`.
- `disableBackground`: if `true` it will make the background transparent.
- `disableAutoRotate`: if `true` it will disable the auto-rotate behaviour of the camera.
- `disableAutoCenter`: if `true` it will disable the auto-center around the bounding box.
- `disableFace`: if `true` it will disable the facial features.
- `disableDefaultWearables`: if `true` it will not load the default wearables (it will only load the base body shape).
- `disableFadeEffect`: if `true` it will disable css transitions (the fade in / fade out effect). This is useful for automation tests.
- `disableDefaultEmotes`: if `true` and `emote` is not passed, it will not load the default IDLE emote.
- `showSceneBoundaries`: if `true` it will show a cylinder representing the recommended scene boundaries.
- `showThumbnailBoundaries`: if `true` it will show a square representing the thumbnail boundaries.
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
    // This message comes every time the preview finished loading
    case PreviewMessageType.LOAD: {
      console.log('Preview loaded successfully')
      break
    }
    // This message comes every time there's an error
    case PreviewMessageType.ERROR: {
      const { message } = event.data.payload as PreviewMessagePayload<PreviewMessageType.ERROR>
      console.error('Something went wrong:', message)
    }
    // This message comes every time there's a native animation event, they only happen with emotes
    case PreviewMessageType.EMOTE_EVENT: {
      const { type, payload } = event.data.payload as PreviewMessagePayload<PreviewMessageType.EMOTE_EVENT>
      switch (type) {
        case PreviewEmoteEventType.ANIMATION_PLAY:
          console.log('Animation started')
          break
        case PreviewEmoteEventType.ANIMATION_PAUSE:
          console.log('Animation paused')
          break
        case PreviewEmoteEventType.ANIMATION_LOOP:
          console.log('Animation looped')
          break
        case PreviewEmoteEventType.ANIMATION_END:
          console.log('Animation ended')
          break
        case PreviewEmoteEventType.ANIMATION_PLAYING:
          console.log('Animation playing: ', payload.length)
          break
      }
    }
  }
}

window.addEventListener('message', handleMessage)
```

### `controller` RPC

The `controller` allows to take screenshots and get metrics from the scene, and also control the emote animations (play/pause/stop/goTo).

To use the controller you can send `controller_request` messages and the response will arrive via a `controller_response` message.

The available methods are:

- namespace: `scene`
  - method: `getScreenshot` params: `[width: number, height: number]` result: `string`
  - method: `getMetrics` params: `[]` result: `Metrics`
- namespace: `emote`
  - method: `play` params: `[]` result: `void`
  - method: `pause` params: `[]` result: `void`
  - method: `stop` params: `[]` result: `void`
  - method: `goTo` params: `[seconds: number]` result: `void`
  - method: `getLength` params: `[]` result: `number`
  - method: `isPlaying` params: `[]` result: `boolean`
  - method: `changeZoom` params: `[zoom: number]` result: `void`
  - method: `changeCameraPosition` params: `[position: { alpha?: number, beta?: number, radius?: number }]` result: `void`
  - method: `panCamera` params: `[offset: { x?: number, y?: number, z?: number }]` result: `void`

This is an example of an RPC:

```ts
import future, { IFuture } from 'fp-future'
import { PreviewMessageType, PreviewMessagePayload, sendMessage } from '@dcl/schemas'

let id = 0
const promises = new Map<string, IFuture<any>>()

function sendRequest<T>(
  namespace: 'scene' | 'emote',
  method: 'getScreenshot' | 'getMetrics' | 'getLength' | 'isPlaying' | 'goTo' | 'play' | 'pause' | 'stop',
  params: any[]
) {
  // create promise
  const promise = future<T>()
  promises.set(id, promise)
  // send message
  sendMessage(iframe.contentWindow, PreviewMessageType.CONTROLLER_REQUEST, { id, namespace, method, params })
  // increment id for next request
  id++
  return promise
}

function handleMessage(event) {
  switch (event.data.type) {
    // handle response
    case PreviewMessageType.CONTROLLER_RESPONSE: {
      const payload = event.data.payload as PreviewMessagePayload<PreviewMessageType.CONTROLLER_RESPONSE>
      // grab promise and resolve/reject according to response
      const { id } = payload
      const promise = promises.get(id)
      if (promise) {
        if (payload.ok) {
          promise.resolve(payload.result)
        } else {
          promise.reject(new Error(payload.error))
        }
      }
      break
    }
  }
}

window.addEventListener('message', handleMessage)
```

Now you can use it like this:

```ts
const screenshot = await sendRequest('scene', 'getScreenshot', [512, 512]) // "data:image/png;base64..."
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
