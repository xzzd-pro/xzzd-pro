import { loadSettings, saveSettings } from '../storage'
import { PROVIDER_DEFAULTS } from '../config'
import type { AssistantSettings, Provider, ProviderConfig } from '../types'
import { showStatus } from '../utils/uiUtils'

let overlayElement: HTMLElement | null = null

const API_KEY_PLACEHOLDER = '请输入 API Key'

// The overlay lives in the host page's DOM, so never write the saved key back
// into an input: page scripts could read it. Show a masked hint instead.
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '已保存'
  return `已保存（${apiKey.slice(0, 3)}…${apiKey.slice(-4)}），留空则保持不变`
}

export function setOverlayElement(element: HTMLElement | null): void {
  overlayElement = element
}

export function setupSettingsHandlers(
  getCurrentSettings: () => AssistantSettings | null,
  setCurrentSettings: (settings: AssistantSettings) => void
): void {
  const panel = overlayElement?.querySelector('#settings-panel')
  const openBtn = overlayElement?.querySelector('#settings-btn')
  const closeBtn = overlayElement?.querySelector('#close-settings-btn')
  const providerSelect = overlayElement?.querySelector('#provider-select') as HTMLSelectElement
  const modelInput = overlayElement?.querySelector('#model-input') as HTMLInputElement
  const apiKeyInput = overlayElement?.querySelector('#api-key-input') as HTMLInputElement
  const baseUrlInput = overlayElement?.querySelector('#base-url-input') as HTMLInputElement
  const saveBtn = overlayElement?.querySelector('#save-settings-btn')

  const fillProviderFields = (config: ProviderConfig | undefined) => {
    apiKeyInput.value = ''
    apiKeyInput.placeholder = config?.apiKey ? maskApiKey(config.apiKey) : API_KEY_PLACEHOLDER
    baseUrlInput.value = config?.baseUrl || ''
    if (config) modelInput.value = config.model
  }

  const openSettings = () => {
    const currentSettings = getCurrentSettings()
    if (!currentSettings) return
    panel?.classList.add('open')

    const provider = currentSettings.provider
    providerSelect.value = provider

    const config = currentSettings.configs[provider]
    const defaults = PROVIDER_DEFAULTS[provider]

    fillProviderFields(config)

    baseUrlInput.placeholder = defaults.baseUrl || '官方默认地址'
  }

  const closeSettings = () => {
    panel?.classList.remove('open')
    apiKeyInput.value = ''
  }

  const saveSettingsHandler = async () => {
    const currentSettings = getCurrentSettings()
    if (!currentSettings || !saveBtn) return
    ;(saveBtn as HTMLButtonElement).disabled = true;
    (saveBtn as HTMLButtonElement).textContent = '保存中...'

    try {
      const provider = providerSelect.value as Provider
      // Empty input keeps the previously saved key for this provider.
      const apiKey = apiKeyInput.value.trim() || currentSettings.configs[provider]?.apiKey || ''
      const baseUrl = baseUrlInput.value.trim()
      const model = modelInput.value.trim()

      // 验证必填字段
      if (!apiKey) {
        alert('❌ API Key 不能为空')
        return
      }
      if (!model) {
        alert('❌ 模型名称不能为空（如：gpt-4, gpt-4-vision 等）')
        return
      }

      const config = {
        apiKey,
        baseUrl,
        model
      }

      currentSettings.provider = provider
      currentSettings.configs[provider] = config

      setCurrentSettings(currentSettings)
      await saveSettings(currentSettings)
      fillProviderFields(config)
      showStatus('设置已保存', 'success', overlayElement)
      closeSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('❌ 保存失败，请重试')
    } finally {
      (saveBtn as HTMLButtonElement).disabled = false;
      (saveBtn as HTMLButtonElement).textContent = '保存设置'
    }
  }

  openBtn?.addEventListener('click', openSettings)
  closeBtn?.addEventListener('click', closeSettings)
  saveBtn?.addEventListener('click', saveSettingsHandler)

  // Switch config display when provider changes
  providerSelect?.addEventListener('change', () => {
    const currentSettings = getCurrentSettings()
    if (!currentSettings) return
    const provider = providerSelect.value as Provider
    const config = currentSettings.configs[provider]
    const defaults = PROVIDER_DEFAULTS[provider]

    fillProviderFields(config)

    baseUrlInput.placeholder = defaults.baseUrl || '官方默认地址'
  })
}
