interface FontControlsProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

export default function FontControls({ fontSize, onFontSizeChange }: FontControlsProps) {
  const minSize = 14;
  const maxSize = 32;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">Font size:</span>
      <button
        onClick={() => onFontSizeChange(Math.max(minSize, fontSize - 2))}
        disabled={fontSize <= minSize}
        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold"
      >
        -
      </button>
      <span className="w-8 text-center text-sm">{fontSize}</span>
      <button
        onClick={() => onFontSizeChange(Math.min(maxSize, fontSize + 2))}
        disabled={fontSize >= maxSize}
        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold"
      >
        +
      </button>
    </div>
  );
}
