// prismjs ships typings for its main bundle only. The core and language
// components are plain scripts; the core exposes the same API.
declare module 'prismjs/components/prism-core' {
  import Prism from 'prismjs';
  export default Prism;
}

declare module 'prismjs/components/prism-*';
