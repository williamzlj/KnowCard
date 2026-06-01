import { useState, useRef, useEffect } from 'react'

const PRESET_COLORS = [
  '#000000', '#ffffff', '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
  '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  '#795548', '#607d8b', '#cccccc', '#999999', '#666666', '#333333',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('recentColors')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const popoverWidth = 240
    const popoverHeight = 320
    let left = rect.right + 8
    let top = rect.bottom - 210
    if (left + popoverWidth > window.innerWidth - 8) {
      left = rect.left - popoverWidth - 8
    }
    if (top + popoverHeight > window.innerHeight) {
      top = window.innerHeight - popoverHeight - 8
    }
    if (left < 8) left = 8
    if (top < 8) top = 8
    setPopoverStyle({ position: 'fixed', left, top, zIndex: 9999 })
  }, [isOpen])

  const handleColorSelect = (color: string) => {
    onChange(color)
    const updated = [color, ...recentColors.filter(c => c !== color)].slice(0, 16)
    setRecentColors(updated)
    sessionStorage.setItem('recentColors', JSON.stringify(updated))
  }

  return (
    <div className="color-picker-wrapper" ref={wrapperRef}>
      <div
        className="color-picker-swatch"
        style={{ backgroundColor: value }}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div className="color-picker-popover" style={popoverStyle}>
          <div className="preset-colors">
            {PRESET_COLORS.map(color => (
              <div
                key={color}
                className="preset-color"
                style={{ backgroundColor: color, outline: value === color ? '2px solid var(--accent-color)' : 'none' }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
          <input
            type="color"
            value={value}
            onChange={(e) => handleColorSelect(e.target.value)}
          />
          {recentColors.length > 0 && (
            <div className="recent-colors">
              <span>最近使用:</span>
              <div className="preset-colors" style={{ marginTop: 4 }}>
                {recentColors.map(color => (
                  <div
                    key={color}
                    className="preset-color"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
