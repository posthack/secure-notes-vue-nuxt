// WebCrypto в новых lib.d.ts требует ArrayBuffer-backed вьюхи, а голый Uint8Array — ArrayBufferLike
export type Bytes = Uint8Array<ArrayBuffer>
