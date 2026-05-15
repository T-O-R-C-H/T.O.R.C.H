import { useTorchStore, type InputMode } from '../../store/torchStore'

const modes: { value: InputMode; label: string }[] = [
  { value: 'type', label: 'TYPE' },
  { value: 'voice', label: 'VOICE' },
  { value: 'heytorch', label: 'HEY TORCH' }
]

export function ModeTabs(): JSX.Element {
  const inputMode = useTorchStore((s) => s.inputMode)
  const setInputMode = useTorchStore((s) => s.setInputMode)

  return (
    <div className="inline-flex border border-[#181818] divide-x divide-[#181818]">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setInputMode(mode.value)}
          className={`px-4 py-1.5 text-[10px] font-mono tracking-[0.06em] transition-all duration-120 ${
            inputMode === mode.value
              ? 'bg-white text-black font-medium'
              : 'bg-transparent text-[#444] hover:text-[#888]'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
