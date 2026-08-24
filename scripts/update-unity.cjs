const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// The renderer lives in the unity-explorer monorepo (avatar-preview-renderer/) since
// https://github.com/decentraland/unity-explorer/pull/9844. Its releases are tagged
// `avatar-preview-renderer/vX.Y.Z` with `make_latest: false` (the repo's "latest release"
// belongs to Explorer client releases), so we list releases and filter by tag prefix
// instead of hitting /releases/latest.
const GITHUB_REPO = 'decentraland/unity-explorer'
const RELEASE_TAG_PREFIX = 'avatar-preview-renderer/v'
// Pin an exact release with RENDERER_TAG=avatar-preview-renderer/vX.Y.Z
const PINNED_TAG = process.env.RENDERER_TAG
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

function githubApiGet(apiPath) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Decentraland-Wearable-Preview',
      Accept: 'application/vnd.github.v3+json',
    }
    // Optional: raises the API rate limit
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    https
      .get(`https://api.github.com${apiPath}`, { headers }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`GitHub API request failed: ${response.statusCode} ${response.statusMessage} (${apiPath})`))
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
      })
      .on('error', reject)
  })
}

async function getLatestRelease() {
  if (PINNED_TAG) {
    if (!PINNED_TAG.startsWith(RELEASE_TAG_PREFIX)) {
      throw new Error(`RENDERER_TAG must start with "${RELEASE_TAG_PREFIX}", got "${PINNED_TAG}"`)
    }
    console.log(`📌 Using pinned tag: ${PINNED_TAG}`)
    const release = await githubApiGet(`/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(PINNED_TAG)}`)
    if (!release.assets || !Array.isArray(release.assets)) {
      throw new Error('Invalid release data: no assets found')
    }
    return release
  }

  // Releases are sorted by creation date (newest first), so the first match is the latest.
  const MAX_PAGES = 5
  for (let page = 1; page <= MAX_PAGES; page++) {
    const releases = await githubApiGet(`/repos/${GITHUB_REPO}/releases?per_page=100&page=${page}`)
    if (!Array.isArray(releases) || releases.length === 0) {
      break
    }
    const release = releases.find((r) => r.tag_name && r.tag_name.startsWith(RELEASE_TAG_PREFIX) && !r.draft)
    if (release) {
      if (!release.assets || !Array.isArray(release.assets)) {
        throw new Error('Invalid release data: no assets found')
      }
      return release
    }
  }

  throw new Error(
    `No release tagged "${RELEASE_TAG_PREFIX}*" found in ${GITHUB_REPO}. ` +
      'Cut one with the "Avatar Preview Renderer Release" workflow in that repo, ' +
      'or pin a tag with RENDERER_TAG.',
  )
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
        const regex = new RegExp(`.*?\\/${folder}\\/?$`, 'i')
        if (regex.test(filePath)) {
          // Store the path up to and including the target folder
          folderPaths.set(folder, filePath)
          console.log(`   Found ${folder} at: ${filePath}`)
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
        execSync(`unzip -o -q "${zipPath}" "${folderInZip}/*" -d "${extractPath}"`)

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
    console.log('🔍 Fetching latest release information...')
    const release = await getLatestRelease()
    console.log(`📦 Found release: ${release.tag_name}`)

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

    console.log('✅ Unity files updated successfully!')
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
