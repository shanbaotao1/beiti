import type { ReactNode } from 'react'

interface FlipCardProps {
  flipped: boolean
  front: ReactNode
  back: ReactNode
}

/** 卡片翻面：根据 flipped 切换正反面，带淡入+轻微缩放动画（移动端稳健，不依赖 3D 高度塌陷） */
export default function FlipCard({ flipped, front, back }: FlipCardProps) {
  return (
    <div className="relative">
      <div
        key={flipped ? 'back' : 'front'}
        className="animate-[fadeScale_0.28s_ease-out]"
      >
        {flipped ? back : front}
      </div>
    </div>
  )
}
