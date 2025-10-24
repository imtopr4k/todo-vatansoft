export function Modal({
  open, title, children, onClose
}:{
  open: boolean; title: string; children: React.ReactNode; onClose: ()=>void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h4>{title}</h4>
        <div>{children}</div>
      </div>
    </div>
  );
}
