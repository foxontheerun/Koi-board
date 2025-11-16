interface TextBlockProps {
  content: string;
}

export function TextBlock({ content }: TextBlockProps) {
  return (
    <div className="relative w-full h-full group">
      <div
        className={`w-full h-full bg-white rounded-lg border p-4 flex items-center justify-center transition-all `}
      >
        <p className="text-[#666666] text-center">{content}</p>
      </div>
    </div>
  );
}
