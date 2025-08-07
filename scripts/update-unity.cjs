const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const GITHUB_API_URL = 'https://api.github.com/repos/decentraland/aang-renderer/releases/latest'
const UNITY_OUTPUT_DIR = path.join(process.cwd(), 'public', 'unity')
const TEMP_DIR = path.join(process.cwd(), 'temp')

// Folders to extract from the ZIP
const REQUIRED_FOLDERS = ['Build', 'StreamingAssets']

// Ensure directories exist
if (!fs.existsSync(UNITY_OUTPUT_DIR)) {
  fs.mkdirSync(UNITY_OUTPUT_DIR, { recursive: true })
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

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    https
      .get(
        GITHUB_API_URL,
        {
          headers: {
            'User-Agent': 'Decentraland-Wearable-Preview',
            Accept: 'application/vnd.github.v3+json',
          },
        },
        (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub API request failed: ${response.statusCode} ${response.statusMessage}`))
            return
          }

          let data = ''
          response.on('data', (chunk) => (data += chunk))
          response.on('end', () => {
            try {
              const release = JSON.parse(data)
              if (!release.assets || !Array.isArray(release.assets)) {
                reject(new Error('Invalid release data: no assets found'))
                return
              }
              resolve(release)
            } catch (error) {
              reject(new Error(`Failed to parse release data: ${error.message}`))
            }
          })
        },
      )
      .on('error', reject)
  })
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
        const destPath = path.join(outputPath, folder)

        if (fs.existsSync(sourcePath)) {
          // Remove destination folder if it exists
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true })
          }
          // Move the folder
          fs.renameSync(sourcePath, destPath)
          console.log(`   ✅ Moved ${folder} to final location`)
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

    // Clean existing unity directory
    console.log('🧹 Cleaning existing Unity files...')
    fs.rmSync(UNITY_OUTPUT_DIR, { recursive: true, force: true })
    fs.mkdirSync(UNITY_OUTPUT_DIR, { recursive: true })

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
