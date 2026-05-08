import { useTorchStore, type InputMode } from '../../store/torchStore'

const modes: { value: InputMode; label: string }[] = [
  { value: 'type', label: 'type' },
  { value: 'voice', label: 'voice' },
  { value: 'heytorch', label: 'hey torch' }
]

export function ModeTabs(): JSX.Element {
  const inputMode = useTorchStore((s) => s.inputMode)
  const setInputMode = useTorchStore((s) => s.setInputMode)

  return (
    <div className="flex border border-[#1c1c1c] inline-flex">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setInputMode(mode.value)}
          className={`px-3 py-1.5 mono-xs transition-colors duration-120 ${
            inputMode === mode.value
              ? 'bg-white text-black'
              : 'bg-transparent text-[#333] hover:text-[#666]'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
