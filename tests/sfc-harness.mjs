import { readFileSync } from 'node:fs'
import { resolveProductSku, withProductSku } from '../utils/product-sku.js'
import { inventoryFields } from '../utils/inventory.js'
import { getImageUrl } from '../utils/config.js'

const imageScript = readFileSync(new URL('../utils/product-image.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
export const { PRODUCT_PLACEHOLDER, useProductImages } = Function('ref', 'getImageUrl',
  `${imageScript}\nreturn { PRODUCT_PLACEHOLDER, useProductImages }`
)(value => ({ value }), getImageUrl)

// 执行页面本身的业务代码，仅替换生命周期、响应式和网络边界。
export const loadSetup = (path, mocks, exports) => {
  mocks = { onUnload() {}, resolveProductSku, withProductSku, inventoryFields, useProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  return Function(...Object.keys(mocks), `${script}\nreturn {${exports.join(',')}}`)(...Object.values(mocks))
}

export const loadOptions = (path, mocks) => {
  mocks = { resolveProductSku, withProductSku, useProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default', 'return')
  return Function(...Object.keys(mocks), script)(...Object.values(mocks))
}
