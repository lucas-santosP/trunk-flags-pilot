/// <reference types="vite/client" />

declare const __APP_ENV__: 'dev' | 'homol' | 'production'
declare const __APP_VERSION__: string
declare const __COMMIT_SHA__: string
declare const __FLAGS__: Readonly<Record<string, boolean>>
