// esbuild bundles these as plain strings (see the bundle scripts in package.json)
declare module '*.html' {
  const text: string
  export default text
}

declare module '*.css' {
  const text: string
  export default text
}
