import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { cn } from "@/lib/utils"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()
const AVATAR_STORAGE_KEY = "userAvatar"

interface AvatarUploadProps {
  className?: string
  fallback?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16"
}

export function AvatarUpload({ className, fallback = "U", size = "md" }: AvatarUploadProps) {
  const [avatarSrc, setAvatarSrc] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load saved avatar on mount
  React.useEffect(() => {
    const loadAvatar = async () => {
      try {
        const savedAvatar = await storage.get<string>(AVATAR_STORAGE_KEY)
        if (savedAvatar) {
          setAvatarSrc(savedAvatar)
        }
      } catch (error) {
        console.error('Failed to load avatar:', error)
      }
    }
    loadAvatar()
  }, [])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB')
      return
    }

    setIsUploading(true)

    try {
      // Create image element to compress
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = async () => {
        try {
          // Create canvas for compression
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            throw new Error('无法创建canvas上下文')
          }

          // Calculate new dimensions (max 200x200 for avatar)
          const maxSize = 200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height

          // Draw and compress image
          ctx.drawImage(img, 0, 0, width, height)

          // Convert to base64 with quality compression
          const base64 = canvas.toBlob(
            async (blob) => {
              if (!blob) {
                alert('图片压缩失败')
                setIsUploading(false)
                return
              }

              // Convert blob to base64
              const reader = new FileReader()
              reader.onload = async (e) => {
                const compressedBase64 = e.target?.result as string

                // Check compressed size (should be much smaller now)
                const sizeInKB = Math.round((compressedBase64.length * 3) / 4 / 1024)
                console.log(`压缩后图片大小: ${sizeInKB}KB`)

                if (sizeInKB > 500) {
                  alert('压缩后图片仍然过大，请选择更小的图片')
                  setIsUploading(false)
                  return
                }

                setAvatarSrc(compressedBase64)

                // Save to storage
                try {
                  await storage.set(AVATAR_STORAGE_KEY, compressedBase64)
                  console.log('头像保存成功')
                } catch (error) {
                  console.error('保存头像失败:', error)
                  alert('保存头像失败，请尝试更小的图片')
                }

                setIsUploading(false)
              }

              reader.onerror = () => {
                alert('读取文件失败')
                setIsUploading(false)
              }

              reader.readAsDataURL(blob)
            },
            'image/jpeg',
            0.8 // Quality: 80%
          )

          // Clean up
          URL.revokeObjectURL(objectUrl)
        } catch (error) {
          console.error('处理图片失败:', error)
          alert('处理图片失败')
          setIsUploading(false)
          URL.revokeObjectURL(objectUrl)
        }
      }

      img.onerror = () => {
        alert('加载图片失败')
        setIsUploading(false)
        URL.revokeObjectURL(objectUrl)
      }

      img.src = objectUrl
    } catch (error) {
      console.error('处理图片失败:', error)
      alert('处理图片失败')
      setIsUploading(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await storage.remove(AVATAR_STORAGE_KEY)
      setAvatarSrc(null)
      console.log('Avatar removed successfully')
    } catch (error) {
      console.error('Failed to remove avatar:', error)
    }
  }

  return (
    <div className="relative group">
      <Avatar
        className={cn(
          sizeClasses[size],
          "cursor-pointer transition-opacity hover:opacity-80",
          isUploading && "opacity-50",
          className
        )}
        onClick={handleAvatarClick}
      >
        {avatarSrc && (
          <AvatarImage
            src={avatarSrc}
            alt="User avatar"
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
          {isUploading ? "..." : fallback}
        </AvatarFallback>
      </Avatar>

      {/* Upload overlay on hover */}
      <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={handleAvatarClick}>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>

      {/* Remove button when avatar exists */}
      {avatarSrc && (
        <button
          onClick={handleRemoveAvatar}
          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80"
          title="删除头像"
        >
          ×
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}