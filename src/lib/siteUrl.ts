// QR kodlara gömülecek site adresi. Yayında VITE_PUBLIC_SITE_URL tanımlanmalı;
// tanımlı değilse tarayıcının adresi kullanılır (geliştirmede localhost olur).
export const SITE_URL: string =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '') ??
  window.location.origin

export const IS_LOCAL_URL = /localhost|127\.0\.0\.1/.test(SITE_URL)
