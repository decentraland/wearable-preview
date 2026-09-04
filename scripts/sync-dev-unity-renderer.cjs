const fs = require('fs')
const path = require('path')

// The renderer now lives in the unity-explorer monorepo under avatar-preview-renderer/.
// Unity names the WebGL output folder after the UCB project (avatar-preview-renderer).
// Override with RENDERER_BUILD_DIR if your local build lands somewhere else.
const SOURCE_DIR =
  process.env.RENDERER_BUILD_DIR ||
  path.join(
    process.env.HOME || process.env.USERPROFILE,
    'Projects',
    'unity-explorer',
    'avatar-preview-renderer',
    'avatar-preview-renderer',
    'Build',
  )
const DEST_DIR = path.join(process.cwd(), 'public', 'unity', 'Build')

// File mappings: source -> destination
const FILE_MAPPINGS = [
  { source: 'avatar-preview-renderer.data.br', dest: 'avatar-preview-renderer.data.br' },
  { source: 'avatar-preview-renderer.framework.js.br', dest: 'avatar-preview-renderer.framework.js.br' },
  { source: 'avatar-preview-renderer.loader.js', dest: 'avatar-preview-renderer.loader.js' },
  { source: 'avatar-preview-renderer.symbols.json.br', dest: 'avatar-preview-renderer.symbols.json.br' },
  { source: 'avatar-preview-renderer.wasm.br', dest: 'avatar-preview-renderer.wasm.br' },
  // Optional uncompressed variants for local development
  { source: 'avatar-preview-renderer.data', dest: 'avatar-preview-renderer.data' },
  { source: 'avatar-preview-renderer.framework.js', dest: 'avatar-preview-renderer.framework.js' },
  { source: 'avatar-preview-renderer.symbols.json', dest: 'avatar-preview-renderer.symbols.json' },
  { source: 'avatar-preview-renderer.wasm', dest: 'avatar-preview-renderer.wasm' },
]

// Ensure destination directory exists
if (!fs.existsSync(DEST_DIR)) {
  console.log(`Creating destination directory: ${DEST_DIR}`)
  fs.mkdirSync(DEST_DIR, { recursive: true })
}

// Check if source directory exists
if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`❌ Source directory does not exist: ${SOURCE_DIR}`)
  console.error('Please ensure the avatar-preview-renderer project is built and the WebGLBuild directory exists.')
  process.exit(1)
}

console.log(`🔄 Syncing files from ${SOURCE_DIR} to ${DEST_DIR}`)
console.log('')

let successCount = 0
let errorCount = 0

// Copy each file
FILE_MAPPINGS.forEach(({ source, dest }) => {
  const sourcePath = path.join(SOURCE_DIR, source)
  const destPath = path.join(DEST_DIR, dest)

  try {
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Source file not found (skipped): ${source}`)
      return
    }

    // Copy the file
    fs.copyFileSync(sourcePath, destPath)

    // Verify the copy was successful
    if (fs.existsSync(destPath)) {
      const sourceStats = fs.statSync(sourcePath)
      const destStats = fs.statSync(destPath)

      if (sourceStats.size === destStats.size) {
        console.log(`✅ Copied: ${source} -> ${dest} (${formatFileSize(sourceStats.size)})`)
        successCount++
      } else {
        console.log(`❌ Copy failed: ${source} -> ${dest} (size mismatch)`)
        errorCount++
      }
    } else {
      console.log(`❌ Copy failed: ${source} -> ${dest}`)
      errorCount++
    }
  } catch (error) {
    console.log(`❌ Error copying ${source}: ${error.message}`)
    errorCount++
  }
})

console.log('')
console.log(`📊 Summary: ${successCount} files copied successfully, ${errorCount} errors`)

if (errorCount === 0) {
  console.log('🎉 All files synced successfully!')
} else {
  console.log('⚠️  Some files failed to sync. Please check the errors above.')
  process.exit(1)
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
