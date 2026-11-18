/** heic-decode ships JavaScript only — this declares its runtime shape */
declare module "heic-decode" {
  export interface HeicDecodedImage {
    width: number;
    height: number;
    /** RGBA pixel data */
    data: Uint8ClampedArray;
  }
  export interface HeicImageHandle {
    width: number;
    height: number;
    decode: () => Promise<HeicDecodedImage>;
  }
  export interface HeicDecodeResult extends Array<HeicImageHandle> {
    dispose?: () => void;
  }
  const decode: (_input: {
    buffer: ArrayBuffer | Uint8Array;
  }) => Promise<HeicDecodeResult>;
  export default decode;
}
