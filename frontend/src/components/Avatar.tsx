import { User } from 'lucide-react'

interface AvatarProps {
  displayName: string
  avatarDataUri: string
  size?: number
}

export function Avatar({ displayName, avatarDataUri, size = 36 }: AvatarProps) {
  if (avatarDataUri) {
    return (
      <img
        src={avatarDataUri}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-semibold text-on-surface-variant"
      style={{ width: size, height: size }}
    >
      {displayName ? displayName.charAt(0).toUpperCase() : <User size={Math.round(size * 0.5)} />}
    </div>
  )
}
