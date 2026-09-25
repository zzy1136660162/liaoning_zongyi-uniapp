import { readFileSync } from 'node:fs'

// 执行页面本身的业务代码，仅替换生命周期、响应式和网络边界。
export const loadSetup = (path, mocks, exports) => {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  return Function(...Object.keys(mocks), `${script}\nreturn {${exports.join(',')}}`)(...Object.values(mocks))
}

export const loadOptions = (path, mocks) => {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default', 'return')
  return Function(...Object.keys(mocks), script)(...Object.values(mocks))
}
