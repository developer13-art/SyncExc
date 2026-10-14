import { toast as sonnerToast } from 'sonner';

export function useToast() {
  return {
    success: (message, options = {}) =>
      sonnerToast.success(message, { duration: 4_000, ...options }),

    error: (message, options = {}) =>
      sonnerToast.error(message, { duration: 8_000, ...options }),

    info: (message, options = {}) =>
      sonnerToast.info(message, { duration: 5_000, ...options }),

    warning: (message, options = {}) =>
      sonnerToast.warning(message, { duration: 6_000, ...options }),

    loading: (message, options = {}) => sonnerToast.loading(message, options),

    promise: (promise, messages, options = {}) =>
      sonnerToast.promise(promise, messages, options),

    dismiss: (id) => sonnerToast.dismiss(id),

    custom: (jsx, options = {}) => sonnerToast.custom(jsx, options),
  };
}