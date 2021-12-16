# Wearable Preview

This webapp renders an interactive 3D preview of a wearable. It can be configured via the following query params:

- `contract`: The contract address of the wearable collection.
- `item`: The id of the item in the collection.
- `token`: The id of the token (to preview a specific NFT).
- `skin`: a color to be used by the skin material, it must be in hex.
- `hair`: a color to be used by the hair material, it must be in hex.
- `shape`: which body shape to use, either `male` or `female`.
- `env`: The environment to use, it can be `prod` (uses mainnet wearables and catalysts) or `dev` (uses testnet wearables and catalysts).

Example: https://wearable-preview.decentraland.org?contract=0xee8ae4c668edd43b34b98934d6d2ff82e41e6488&item=5

### Development

```
npm run start
```

### Build

```
npm run build
```
