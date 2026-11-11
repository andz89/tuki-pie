/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

declare module '*.js?raw' {
  const source: string;
  export default source;
}

declare module '*.sql?raw' {
  const sql: string;
  export default sql;
}
