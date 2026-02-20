// Storage helper for beautify settings
export async function getBeautifyEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('beautify-enabled')
    // Default to true if not set
    return result['beautify-enabled'] !== false
  } catch (error) {
    console.error('XZZDPRO: Failed to get beautify setting', error)
    return true
  }
}

export async function setBeautifyEnabled(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ 'beautify-enabled': enabled })
    console.log('XZZDPRO: Beautify setting saved:', enabled)
  } catch (error) {
    console.error('XZZDPRO: Failed to save beautify setting', error)
  }
}
