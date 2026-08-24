const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// The renderer lives in the decentraland/unity-explorer monorepo, released under
// avatar-preview-renderer/vX.Y.Z tags. The repo's "latest release" belongs to the
// Explorer desktop client, so this script lists releases and picks the newest one
// with the renderer's tag prefix. Pass a version to pin one instead:
// `npm run update-unity -- 3.0.1` or RENDERER_VERSION=3.0.1.
const OWNER_REPO = 'decentraland/unity-explorer'
const TAG_PREFIX = 'avatar-preview-renderer/v'
const PINNED_VERSION = process.env.RENDERER_VERSION || process.argv[2] || ''

const UNITY_OUTPUT_DIR = path.join(process.cwd(), 'public', 'unity')
const EMOTES_OUTPUT_DIR = path.join(process.cwd(), 'public', 'emotes')
const TEMP_DIR = path.join(process.cwd(), 'temp')

// Folders to extract from the ZIP
const REQUIRED_FOLDERS = ['Build', 'StreamingAssets']

// Ensure directories exist
if (!fs.existsSync(UNITY_OUTPUT_DIR)) {
  fs.mkdirSync(UNITY_OUTPUT_DIR, { recursive: true })
}
if (!fs.existsSync(EMOTES_OUTPUT_DIR)) {
  fs.mkdirSync(EMOTES_OUTPUT_DIR, { recursive: true })
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

function apiGet(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Decentraland-Wearable-Preview',
      Accept: 'application/vnd.github.v3+json',
    }
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    https
      .get(
        url,
        { headers },
        (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub API request failed: ${response.statusCode} ${response.statusMessage} (${url})`))
            return
          }

          let data = ''
          response.on('data', (chunk) => (data += chunk))
          response.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch (error) {
              reject(new Error(`Failed to parse GitHub API response: ${error.message}`))
            }
          })
        },
      )
      .on('error', reject)
  })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)

    const handleResponse = (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        https
          .get(
            response.headers.location,
            {
              headers: {
                'User-Agent': 'Decentraland-Wearable-Preview',
                Accept: 'application/octet-stream',
              },
            },
            handleResponse,
          )
          .on('error', reject)
        return
      }

      // Check if the response is successful
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`))
        return
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        // Verify file exists and has content
        fs.stat(destPath, (err, stats) => {
          if (err) {
            reject(new Error(`Failed to verify downloaded file: ${err.message}`))
            return
          }
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty'))
            return
          }
          resolve()
        })
      })
    }

    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Decentraland-Wearable-Preview',
            Accept: 'application/octet-stream',
          },
        },
        handleResponse,
      )
      .on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
  })
}

async function getRendererRelease() {
  if (PINNED_VERSION) {
    const tag = `${TAG_PREFIX}${PINNED_VERSION.replace(/^v/, '')}`
    return apiGet(`https://api.github.com/repos/${OWNER_REPO}/releases/tags/${encodeURIComponent(tag)}`)
  }

  // `releases/latest` would return the Explorer release; list and filter instead.
  // Releases are returned newest-first.
  for (let page = 1; page <= 5; page++) {
    const releases = await apiGet(`https://api.github.com/repos/${OWNER_REPO}/releases?per_page=30&page=${page}`)
    if (!Array.isArray(releases) || releases.length === 0) break

    const release = releases.find((r) => r.tag_name.startsWith(TAG_PREFIX) && !r.draft && !r.prerelease)
    if (release) return release
  }

  throw new Error(`No ${TAG_PREFIX}* release found in ${OWNER_REPO}`)
}

function findFolderPaths(zipPath, targetFolders) {
  try {
    // List all contents of the ZIP file
    const zipContents = execSync(`unzip -l "${zipPath}"`, { stdio: 'pipe' }).toString()
    const lines = zipContents.split('\n')

    // Create a map to store the base paths for each target folder
    const folderPaths = new Map()

    // Process each line to find the folders
    for (const line of lines) {
      // Skip empty lines and headers
      if (!line.trim() || line.includes('---') || line.includes('Archive:')) continue

      // Extract the file path from the line
      const match = line.trim().match(/[\d\s-:]+(.+)/)
      if (!match) continue

      const filePath = match[1].trim()

      // Check if this path contains any of our target folders
      for (const folder of targetFolders) {
        if (folderPaths.has(folder)) continue

        // Match the folder as a path segment (root or nested), on directory
        // entries and file entries alike — some ZIPs omit directory entries.
        const segmentMatch = filePath.match(new RegExp(`^(.*?(?:^|\\/))(${folder})(\\/|$)`, 'i'))
        if (segmentMatch) {
          const basePath = `${segmentMatch[1]}${segmentMatch[2]}/`
          folderPaths.set(folder, basePath)
          console.log(`   Found ${folder} at: ${basePath}`)
          break
        }
      }
    }

    return folderPaths
  } catch (error) {
    throw new Error(`Failed to analyze ZIP contents: ${error.message}`)
  }
}

function extractZip(zipPath, outputPath) {
  try {
    // First verify the file exists and is not empty
    const stats = fs.statSync(zipPath)
    if (stats.size === 0) {
      throw new Error('ZIP file is empty')
    }

    // Create a temporary extraction directory
    const extractPath = path.join(TEMP_DIR, 'extract')
    fs.mkdirSync(extractPath, { recursive: true })

    // Find the actual paths of the folders in the ZIP
    console.log('   Analyzing ZIP contents...')
    const folderPaths = findFolderPaths(zipPath, REQUIRED_FOLDERS)

    // Extract each found folder
    for (const [folder, folderPath] of folderPaths.entries()) {
      try {
        console.log(`   Extracting ${folder} folder...`)
        // Extract the folder and its contents
        // The `/*` at the end ensures we get the contents
        const folderInZip = path.dirname(folderPath)
        const unzipPattern = folderInZip === '.' ? `${folder}/*` : `${folderInZip}/*`
        execSync(`unzip -o -q "${zipPath}" "${unzipPattern}" -d "${extractPath}"`)

        // Move the specific folder to the final destination
        const sourcePath = path.join(extractPath, folderPath)
        let destPath

        if (folder === 'StreamingAssets') {
          // StreamingAssets contents go to public/emotes
          destPath = EMOTES_OUTPUT_DIR

          if (fs.existsSync(sourcePath)) {
            // Remove destination folder if it exists
            if (fs.existsSync(destPath)) {
              fs.rmSync(destPath, { recursive: true, force: true })
              fs.mkdirSync(destPath, { recursive: true })
            }

            // Copy all contents of StreamingAssets to emotes folder
            const items = fs.readdirSync(sourcePath)
            for (const item of items) {
              const sourceItem = path.join(sourcePath, item)
              const destItem = path.join(destPath, item)

              if (fs.statSync(sourceItem).isDirectory()) {
                fs.cpSync(sourceItem, destItem, { recursive: true })
              } else {
                fs.copyFileSync(sourceItem, destItem)
              }
            }
            console.log(`   ✅ Copied ${folder} contents to emotes folder`)
          }
        } else {
          // Other folders go to their normal location
          destPath = path.join(outputPath, folder)

          if (fs.existsSync(sourcePath)) {
            // Remove destination folder if it exists
            if (fs.existsSync(destPath)) {
              fs.rmSync(destPath, { recursive: true, force: true })
            }
            // Move the folder
            fs.renameSync(sourcePath, destPath)
            console.log(`   ✅ Moved ${folder} to final location`)
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error extracting ${folder}: ${error.message}`)
      }
    }

    // Clean up the temporary extraction directory
    fs.rmSync(extractPath, { recursive: true, force: true })
  } catch (error) {
    throw new Error(`Failed to extract ZIP file: ${error.message}`)
  }
}

async function main() {
  try {
    console.log('🔍 Fetching renderer release information...')
    const release = await getRendererRelease()
    console.log(`📦 Found release: ${release.tag_name}`)
    console.log(`   Commit: ${release.target_commitish}`)
    console.log(`   Notes:  ${release.html_url}`)

    if (!release.assets || release.assets.length === 0) {
      throw new Error(`Release ${release.tag_name} has no assets`)
    }

    // Clean existing unity and GLB directories
    console.log('🧹 Cleaning existing Unity files...')
    fs.rmSync(UNITY_OUTPUT_DIR, { recursive: true, force: true })
    fs.mkdirSync(UNITY_OUTPUT_DIR, { recursive: true })

    console.log('🧹 Cleaning existing GLB files...')
    fs.rmSync(EMOTES_OUTPUT_DIR, { recursive: true, force: true })
    fs.mkdirSync(EMOTES_OUTPUT_DIR, { recursive: true })

    // Download and process each asset
    for (const asset of release.assets) {
      const tempPath = path.join(TEMP_DIR, asset.name)
      console.log(`⬇️  Downloading ${asset.name}...`)
      console.log(`   URL: ${asset.browser_download_url}`)
      console.log(`   Size: ${(asset.size / 1024 / 1024).toFixed(2)} MB`)

      await downloadFile(asset.browser_download_url, tempPath)

      // Verify the downloaded file
      const downloadedSize = fs.statSync(tempPath).size
      console.log(`   Downloaded size: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`)

      if (downloadedSize === 0) {
        throw new Error(`Downloaded file is empty: ${asset.name}`)
      }

      if (asset.name.endsWith('.zip')) {
        console.log(`📂 Extracting ${asset.name}...`)
        extractZip(tempPath, UNITY_OUTPUT_DIR)
      }
    }

    // Cleanup
    console.log('🧹 Cleaning up temporary files...')
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })

    console.log(`✅ Unity files updated to ${release.tag_name} — commit the changes in public/unity and public/emotes.`)
  } catch (error) {
    console.error('❌ Error updating Unity files:', error)
    // Log more details about the error
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

main()
