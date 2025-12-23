# AI Agent Context

**Service Purpose:**

The Wearable Preview is a webapp that renders interactive 3D previews of Decentraland wearables, emotes, and avatars. It is designed to be embedded as an iframe in other applications (like the Builder, Marketplace, or third-party tools) and provides a rich API for configuration and control via query parameters and postMessage.

**Key Capabilities:**

- Render 3D avatars with equipped wearables using Babylon.js or Unity WebGL
- Preview individual wearables on a configurable avatar
- Play and control emote animations with playback controls
- Support social emotes (two-person interactions)
- Interactive camera controls (pan, zoom, rotate)
- Programmatic screenshot capture via RPC
- Load items from multiple sources: URN, URL, base64, or contract/item IDs
- Customizable avatar appearance (skin, hair, eyes, body shape)
- Configurable camera, lighting, and display options

**Communication Pattern:**

- Query parameters for initial configuration
- postMessage API for runtime updates and control
- RPC-style request/response for controller methods (screenshots, emote control)
- Event emission for load status and animation events

**Technology Stack:**

- Runtime: Node.js 22
- Framework: React 18
- Build Tool: Vite
- Language: TypeScript
- 3D Rendering: Babylon.js 8.x (primary), Unity WebGL (alternative renderer)
- UI: decentraland-ui
- Schemas: @dcl/schemas for type definitions and message types

**External Dependencies:**

- Peer/Catalyst Server (`PEER_URL`): Fetches wearable/emote entities, avatar profiles, and content files
- Marketplace API (`MARKETPLACE_SERVER_URL`): Retrieves item and NFT data by contract address and item/token ID

**Key Concepts:**

- **WearableDefinition**: Schema type defining a wearable with metadata, representations, and content URLs
- **EmoteDefinition**: Schema type defining an emote with animation data and representations
- **Profile**: User's avatar configuration including equipped wearables, colors, and body shape
- **URN**: Uniform Resource Name identifying a specific wearable or emote in the Decentraland ecosystem
- **Representation**: Body-shape-specific version of a wearable/emote with 3D models and textures
- **Controller RPC**: Request/response messaging system for programmatic control (screenshots, animation)
- **Social Emote**: Two-person emote that duplicates the avatar and plays coordinated animations

**Message Types (from @dcl/schemas):**

- `PreviewMessageType.UPDATE`: Update preview options at runtime
- `PreviewMessageType.LOAD`: Emitted when preview finishes loading
- `PreviewMessageType.ERROR`: Emitted on errors
- `PreviewMessageType.EMOTE_EVENT`: Animation events (play, pause, loop, end)
- `PreviewMessageType.CONTROLLER_REQUEST`: RPC request to controller
- `PreviewMessageType.CONTROLLER_RESPONSE`: RPC response from controller

**Main Source Structure:**

```
src/
  components/
    Preview/          # Main Babylon.js preview component
    UnityPreview/     # Unity WebGL preview component
    WebGPUWarning/    # WebGPU compatibility warning
  hooks/
    useOptions.ts     # Query parameter parsing
    useController.ts  # RPC controller logic
    useMessage.ts     # postMessage handling
  lib/
    api/
      peer.ts         # Catalyst/Peer API client
      nft.ts          # Marketplace API client
    babylon/          # Babylon.js rendering logic
    unity/            # Unity WebGL rendering logic
  config/
    env/              # Environment configurations (dev, stg, prod)
```

