interface PinIconProps {
  size?: number
  color?: string
}

export function PinIcon({ size = 14, color = 'currentColor' }: PinIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M15 11V3h1.5V1.5h-9V3H9v8l-2.5 2.5v2h5.5v7h1.5v-7H18v-2l-2.5-2.5z" />
    </svg>
  )
}

export function PinOffIcon({ size = 14, color = 'currentColor' }: PinIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 11V3h1.5V1.5h-9V3H9v8l-2.5 2.5v2h5.5v7h1.5v-7H18v-2l-2.5-2.5z" />
    </svg>
  )
}
