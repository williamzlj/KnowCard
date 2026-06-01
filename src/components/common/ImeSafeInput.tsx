import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react'

interface ImeInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function ImeSafeInput({ value, onChange, ...rest }: ImeInputProps) {
  const [local, setLocal] = useState(value)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!composingRef.current) {
      setLocal(value)
    }
  }, [value])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocal(v)
    if (!composingRef.current) {
      onChange(v)
    }
  }, [onChange])

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    const v = (e.target as HTMLInputElement).value
    setLocal(v)
    onChange(v)
  }, [onChange])

  return (
    <input
      type="text"
      value={local}
      onChange={handleChange}
      onCompositionStart={() => { composingRef.current = true }}
      onCompositionEnd={handleCompositionEnd}
      {...rest}
    />
  )
}
