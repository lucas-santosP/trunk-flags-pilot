/// <reference types="vite/client" />

declare const __APP_ENV__: 'dev' | 'homol' | 'production'
declare const __APP_VERSION__: string
declare const __COMMIT_SHA__: string
declare const __FLAGS__: Readonly<Record<string, boolean>>
declare const __FLAG_MATRIX__: Readonly<
  Record<'dev' | 'homol' | 'production', Record<string, boolean>>
>
