# Wearable Preview

A webapp that renders interactive 3D previews of Decentraland wearables, emotes, and avatars. It can be embedded as an iframe and controlled via query parameters or `postMessage` API.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Build](#build)
- [Usage](#usage)
  - [Query Parameters](#query-parameters)
  - [iframe API](#iframe-api)
  - [iframe Events](#iframe-events)
  - [Controller RPC](#controller-rpc)
- [Testing](#testing)

## Features

- **3D Avatar Preview**: Render full avatars with equipped wearables
- **Wearable Preview**: Preview individual wearables on an avatar
- **Emote Preview**: Play and control emote animations
- **Social Emotes**: Preview two-person social interaction emotes
- **Interactive Camera**: Pan, zoom, and rotate around the preview
- **Screenshot Capture**: Programmatically capture screenshots via RPC
- **iframe Embeddable**: Easy integration via iframe with postMessage API
- **Multiple Input Sources**: Load items via URN, URL, base64, or contract/item IDs

## Dependencies & Related Services

This webapp interacts with the following services:

- **[Peer/Catalyst Server](https://github.com/decentraland/catalyst)**: Fetches wearable/emote entities, profiles, and content
- **[Marketplace API](https://github.com/decentraland/marketplace)**: Retrieves item and NFT data by contract address

## Getting Started

### Prerequisites

- **Node.js**: Version 22.x
- **npm**: Latest version compatible with Node.js 22.x

### Installation

```bash
npm ci
```

### Development

Start the development server:

```bash
npm run start
```

### Build

Build for production:

```bash
npm run build
```

## Usage

### Query Parameters

Configure the preview via URL query parameters:

#### Item Loading

| Parameter  | Description                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract` | The contract address of the wearable collection                                                                                                                                                                                                                                                                                                      |
| `item`     | The id of the item in the collection                                                                                                                                                                                                                                                                                                                 |
| `token`    | The id of the token (to preview a specific NFT)                                                                                                                                                                                                                                                                                                      |
| `profile`  | An ethereum address of a profile to load as the base avatar. It can be set to `default` or a numbered default profile like `default15`                                                                                                                                                                                                               |
| `urn`      | A URN of a wearable or emote to load. If it is a wearable, it will override anything loaded from a profile. Can be used multiple times                                                                                                                                                                                                               |
| `url`      | A URL of a wearable or emote to load. Must return a valid [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) or [`EmoteDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/emote-definition.ts). Can be used multiple times               |
| `base64`   | A wearable or emote encoded in base64. Once parsed it should be a valid [`WearableDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/wearable-definition.ts) or [`EmoteDefinition`](https://github.com/decentraland/common-schemas/blob/main/src/dapps/preview/emote-definition.ts). Can be used multiple times |

#### Avatar Customization

| Parameter   | Description                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `skin`      | A color to be used by the skin material, must be in hex                                                                             |
| `hair`      | A color to be used by the hair material, must be in hex                                                                             |
| `eyes`      | A color to be used by the eyes tint, must be in hex                                                                                 |
| `bodyShape` | Which body shape to use: `urn:decentraland:off-chain:base-avatars:BaseMale` or `urn:decentraland:off-chain:base-avatars:BaseFemale` |

#### Emote & Animation

| Parameter     | Description                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `emote`       | The emote that the avatar will play. Default: `idle`. Options: `clap`, `dab`, `dance`, `fashion`, `fashion-2`, `fashion-3`, `fashion-4`, `love`, `money`, `fist-pump`, `head-explode`                                                                                |
| `socialEmote` | When specified, duplicates the avatar and plays different animations on each to create a social interaction. JSON object with: `title` (required), `loop` (required), `audio` (optional), `Armature`, `Armature_Prop`, `Armature_Other` (optional animation configs) |

#### Camera & View

| Parameter        | Description                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `zoom`           | The level of zoom, must be a number between 1 and 100                                                                        |
| `zoomScale`      | A multiplier for the zoom level. Default: `1`, can be increased for extra zoom                                               |
| `camera`         | Which camera type to use: `interactive` or `static`. Default: `interactive`                                                  |
| `projection`     | Which projection type to use: `orthographic` or `perspective`. Default: `perspective`                                        |
| `offsetX/Y/Z`    | Apply an offset in the X/Y/Z position of the scene. Default: `0`                                                             |
| `cameraX/Y/Z`    | Set the X/Y/Z position of the camera                                                                                         |
| `wheelZoom`      | A multiplier of how much the user can zoom with the mouse wheel. Default: `1` (no zoom). Value of `2` allows zoom up to 2x   |
| `wheelPrecision` | The higher the value, the slower the wheel zooms when scrolled. Default: `100`                                               |
| `wheelStart`     | A value between 0 and 100 determining initial zoom. Default: `50`. Value of `0` starts at min zoom, `100` starts at max zoom |
| `panning`        | If `true`, enables panning capability. Default: `true`                                                                       |
| `lockAlpha`      | If `true`, locks the alpha rotation (horizontal rotation)                                                                    |
| `lockBeta`       | If `true`, locks the beta rotation (vertical rotation)                                                                       |
| `lockRadius`     | If `true`, locks the radius (zoom distance)                                                                                  |

#### Display Options

| Parameter                 | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `background`              | The color of the background in hex, e.g.: `ff0000`                                    |
| `disableBackground`       | If `true`, makes the background transparent                                           |
| `disableAutoRotate`       | If `true`, disables the auto-rotate behaviour of the camera                           |
| `disableAutoCenter`       | If `true`, disables the auto-center around the bounding box                           |
| `disableFace`             | If `true`, disables the facial features                                               |
| `disableDefaultWearables` | If `true`, will not load default wearables (only loads the base body shape)           |
| `disableFadeEffect`       | If `true`, disables CSS transitions (fade in/out effect). Useful for automation tests |
| `disableDefaultEmotes`    | If `true` and `emote` is not passed, will not load the default IDLE emote             |
| `showSceneBoundaries`     | If `true`, shows a cylinder representing the recommended scene boundaries             |
| `showThumbnailBoundaries` | If `true`, shows a square representing the thumbnail boundaries                       |

#### Configuration

| Parameter              | Description                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `peerUrl`              | Set a custom URL for a Catalyst peer                                                                        |
| `marketplaceServerUrl` | Set a custom URL for the Marketplace API                                                                    |
| `nftServerUrl`         | Set a custom URL for the Marketplace API (legacy, `marketplaceServerUrl` takes priority)                    |
| `type`                 | Set a custom PreviewType for standalone items passed as urn/url/base64. Currently only supports: `wearable` |
| `env`                  | The environment to use: `prod` (mainnet wearables and catalysts) or `dev` (testnet)                         |

**Example:** https://wearable-preview.decentraland.org?contract=0xee8ae4c668edd43b34b98934d6d2ff82e41e6488&item=5

### iframe API

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

### iframe Events

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

### Controller RPC

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
  params: any[],
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

## Testing

Run tests:

```bash
npm run test
```

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).

---
