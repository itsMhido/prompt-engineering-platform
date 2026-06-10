export default function AlertModal({ isOpen, title, message, onClose, buttonText = "OK" }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-md rounded-lg border border-[#252320] bg-[#161613] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-bold text-gray-100">{title}</h3>
        <p className="mb-6 text-sm text-gray-400">{message}</p>
        
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="rounded bg-[#88d273] px-4 py-2 text-sm font-medium text-[#0d0d0b] hover:bg-[#88d273]/90 transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
