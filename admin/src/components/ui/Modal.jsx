import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog.jsx';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  size = 'md',
  showClose = true,
  className,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} className={className} showClose={showClose}>
        {title || description ? (
          <DialogHeader>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}