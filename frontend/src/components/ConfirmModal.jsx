export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div 
        className="w-full max-w-md rounded-lg border border-[#252320] bg-[#161613] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-bold text-gray-100">{title}</h3>
        <p className="mb-6 text-sm text-gray-400">{message}</p>
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${isDanger ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-[#88d273] text-[#0d0d0b] hover:bg-[#88d273]/90'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
