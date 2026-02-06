const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization — APPLE_ID, APPLE_APP_PASSWORD, or APPLE_TEAM_ID not set')
    return
  }

  const appName = context.packager.appInfo.productFilename

  console.log(`Notarizing ${appName}...`)

  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId,
    appleIdPassword,
    teamId
  })

  console.log('Notarization complete')
}
