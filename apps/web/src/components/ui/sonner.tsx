import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-[var(--radius)] border border-border',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
