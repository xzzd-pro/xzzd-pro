import React from "react"
import { createRoot } from "react-dom/client"

import { storage } from "@/lib/storage"

import { bindLayoutControl } from "./bindings"
import {
  applyPageBackground,
  DEFAULT_PAGE_BACKGROUND,
  loadPageBackground,
  PAGE_BACKGROUND_IMAGE_KEY,
  PAGE_BACKGROUND_KEY,
  PAGE_TINTS,
  prepareBackgroundImage,
  removeLegacyAvatar,
  savePageBackground,
  savePageBackgroundImage,
  type PageBackgroundSettings,
  type PageTintId
} from "./page-background"

const FADE_SAVE_DELAY_MS = 300

const IMAGE_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15L17.9 11.9C17.12 11.12 15.88 11.12 15.1 11.9L6 21" />
  </svg>
)

/**
 * Header button with a panel for choosing the page tint and background image.
 * Changes are saved to extension storage and followed across tabs.
 */
function BackgroundPicker() {
  const [open, setOpen] = React.useState(false)
  const [settings, setSettings] = React.useState<PageBackgroundSettings>(
    DEFAULT_PAGE_BACKGROUND
  )
  const [image, setImage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const fadeTimerRef = React.useRef<number>()

  React.useEffect(() => {
    let active = true
    const reload = () => {
      loadPageBackground()
        .then((saved) => {
          if (!active) return
          setSettings(saved.settings)
          setImage(saved.image)
        })
        .catch((loadError) =>
          console.warn("XZZDPRO: Failed to load page background", loadError)
        )
    }
    reload()
    const callbacks = {
      [PAGE_BACKGROUND_KEY]: reload,
      [PAGE_BACKGROUND_IMAGE_KEY]: reload
    }
    storage.watch(callbacks)
    return () => {
      active = false
      storage.unwatch(callbacks)
      window.clearTimeout(fadeTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    applyPageBackground(settings, image)
  }, [settings, image])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const updateSettings = (next: PageBackgroundSettings) => {
    setSettings(next)
    savePageBackground(next).catch((saveError) =>
      console.error("XZZDPRO: Failed to save page background", saveError)
    )
  }

  const selectTint = (tint: PageTintId) => updateSettings({ ...settings, tint })

  const changeFade = (fade: number) => {
    const next = { ...settings, fade }
    setSettings(next)
    window.clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = window.setTimeout(
      () => updateSettings(next),
      FADE_SAVE_DELAY_MS
    )
  }

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const prepared = await prepareBackgroundImage(file)
      await savePageBackgroundImage(prepared)
      setImage(prepared)
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "图片保存失败"
      )
    } finally {
      setBusy(false)
    }
  }

  const removeImage = async () => {
    setError("")
    try {
      await savePageBackgroundImage(null)
      setImage(null)
    } catch {
      setError("移除图片失败，请重试")
    }
  }

  const reset = async () => {
    window.clearTimeout(fadeTimerRef.current)
    updateSettings(DEFAULT_PAGE_BACKGROUND)
    await removeImage()
  }

  return (
    <div className="bg-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-btn bg-picker-trigger"
        title="页面背景"
        aria-label="页面背景"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        {IMAGE_ICON}
      </button>
      {open && (
        <div className="bg-picker-panel" role="dialog" aria-label="页面背景">
          <div className="bg-picker-section">
            <div className="bg-picker-label">背景色</div>
            <div className="bg-picker-swatches">
              {PAGE_TINTS.map((tint) => (
                <button
                  key={tint.id}
                  type="button"
                  className="bg-swatch"
                  data-tint={tint.id}
                  aria-pressed={settings.tint === tint.id}
                  title={tint.name}
                  style={
                    tint.light
                      ? ({
                          "--swatch-light": tint.light,
                          "--swatch-dark": tint.dark
                        } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => selectTint(tint.id)}>
                  <span className="bg-swatch-name">{tint.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-picker-section">
            <div className="bg-picker-label">背景图片</div>
            {image && (
              <div
                className="bg-picker-thumb"
                style={{ backgroundImage: "var(--page-image)" }}
              />
            )}
            <div className="bg-picker-actions">
              <button
                type="button"
                className="bg-picker-btn"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}>
                {busy ? "处理中..." : image ? "更换图片" : "上传图片"}
              </button>
              {image && (
                <button
                  type="button"
                  className="bg-picker-btn"
                  disabled={busy}
                  onClick={() => void removeImage()}>
                  移除
                </button>
              )}
            </div>
            {image && (
              <label className="bg-picker-slider">
                <span>图片淡化 {Math.round(settings.fade * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={Math.round(settings.fade * 100)}
                  onChange={(event) =>
                    changeFade(Number(event.target.value) / 100)
                  }
                />
              </label>
            )}
            {error && (
              <p className="bg-picker-error" role="alert">
                {error}
              </p>
            )}
            <p className="bg-picker-hint">图片只保存在本机，最大 20 MB。</p>
          </div>

          <button
            type="button"
            className="bg-picker-reset"
            onClick={() => void reset()}>
            恢复默认
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void uploadImage(event)}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Mounts the page background picker in the header and applies the saved background.
 */
export function setupBackgroundPicker(): void {
  const container = document.getElementById("page-background-picker")
  if (!container) return
  const binding = bindLayoutControl("page-background", container)
  if (!binding) return

  removeLegacyAvatar()
  const root = createRoot(container)
  binding.onCleanup(() => root.unmount())
  root.render(React.createElement(BackgroundPicker))
}
