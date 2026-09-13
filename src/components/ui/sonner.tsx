import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** App-styled notifications: the same card surface, hairline border and label typography as the
 * workspace frames, with a coloured left edge marking the kind. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      closeButton
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto w-full gap-2.5 rounded-xl border border-border border-l-4 border-l-border bg-card px-4 py-3 text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]",
          // Same face and size as the workflow sub-step labels, bold and in plain black.
          title: "font-sans text-[13px] font-bold leading-snug text-foreground",
          description: "mt-0.5 text-xs leading-relaxed text-muted-foreground",
          icon: "mt-0.5",
          actionButton:
            "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground",
          cancelButton:
            "rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
          // Sonner puts the close control top-left by default; move it to the top-right corner.
          closeButton:
            "!left-auto !right-0 border-border bg-card text-muted-foreground hover:text-foreground",
          success: "border-l-success [&_[data-icon]]:text-success",
          warning: "border-l-warning [&_[data-icon]]:text-warning",
          error: "border-l-destructive [&_[data-icon]]:text-destructive",
          info: "border-l-primary [&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
