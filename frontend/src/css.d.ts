/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>
  export default content
  export = content
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
  export = classes
}

declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>
  export default classes
  export = classes
}

declare module '*.scss' {
  const content: Record<string, string>
  export default content
  export = content
}

declare module '*.less' {
  const content: Record<string, string>
  export default content
  export = content
}

declare module '*.sass' {
  const content: Record<string, string>
  export default content
  export = content
}
