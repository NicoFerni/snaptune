// Shared by the compose form and the server: what one send may carry, attachments included.
// Vercel refuses request bodies over 4.5 MB (next.config.ts lets Server Actions take that much).
export const MAX_UPLOAD = 4 * 1024 * 1024;
