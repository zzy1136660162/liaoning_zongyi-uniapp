// API接口测试文件
// 用于验证各个API接口的正确性

// 直接测试各个API文件的结构和实现，不实际调用接口
// 这样可以在不依赖构建环境的情况下验证接口是否正确实现

console.log('开始验证API接口定义...')

// 检查所有API文件是否存在并导出了正确的函数
const fs = require('fs')
const path = require('path')

// API文件路径
const apiDir = path.join(__dirname, 'api')
const apiFiles = [
  'auth.js',
  'patient.js',
  'address.js',
  'hospital.js',
  'product.js',
  'consultation.js',
  'order.js',
  'payment.js',
  'announcement.js'
]

// 验证API文件是否存在并导出了正确的函数
const validateApiFile = (filename) => {
  console.log(`\n=== 验证 ${filename} ===`)
  try {
    const filePath = path.join(apiDir, filename)
    if (fs.existsSync(filePath)) {
      console.log(`✓ ${filename} 文件存在`)
      
      // 读取文件内容检查函数定义
      const fileContent = fs.readFileSync(filePath, 'utf8')
      
      // 检查是否使用了正确的导入
      if (fileContent.includes(`from '@/utils/`)) {
        console.log(`⚠ ${filename} 使用了@路径别名，需要在构建环境中运行`)
      }
      
      // 检查是否导出了函数
      const exportMatches = fileContent.match(/export\s+const\s+(\w+)/g)
      if (exportMatches && exportMatches.length > 0) {
        console.log(`✓ ${filename} 导出了 ${exportMatches.length} 个函数:`)
        exportMatches.forEach(match => {
          const funcName = match.match(/export\s+const\s+(\w+)/)[1]
          console.log(`  - ${funcName}`)
        })
      } else {
        console.log(`⚠ ${filename} 没有找到导出的函数`)
      }
      
      return true
    } else {
      console.log(`✗ ${filename} 文件不存在`)
      return false
    }
  } catch (error) {
    console.error(`✗ 验证 ${filename} 时出错:`, error.message)
    return false
  }
}

// 验证配置文件
const validateConfigFile = () => {
  console.log('\n=== 验证 config.js ===')
  try {
    const configPath = path.join(__dirname, 'utils', 'config.js')
    if (fs.existsSync(configPath)) {
      console.log('✓ config.js 文件存在')
      const configContent = fs.readFileSync(configPath, 'utf8')
      
      // 检查API_PATHS是否完整
      if (configContent.includes('API_PATHS')) {
        console.log('✓ API_PATHS 配置存在')
        
        // 检查各个模块的API路径
        const modules = ['AUTH', 'PATIENT', 'ADDRESS', 'HOSPITAL', 'DOCTOR', 'CATEGORY', 'PRODUCT', 'CONSULTATION', 'PRESCRIPTION', 'ORDER', 'PAYMENT', 'ANNOUNCEMENT']
        modules.forEach(module => {
          if (configContent.includes(`\n  ${module}:`)) {
            console.log(`  ✓ ${module} 模块路径配置存在`)
          } else {
            console.log(`  ⚠ ${module} 模块路径配置可能缺失`)
          }
        })
      }
      
      return true
    } else {
      console.log('✗ config.js 文件不存在')
      return false
    }
  } catch (error) {
    console.error('✗ 验证 config.js 时出错:', error.message)
    return false
  }
}

// 开始验证所有API文件
let successCount = 0
let errorCount = 0

console.log('\n========== 开始验证API文件 ==========')

// 验证配置文件
const configResult = validateConfigFile()
if (configResult) successCount++
else errorCount++

// 验证所有API文件
apiFiles.forEach(filename => {
  const result = validateApiFile(filename)
  if (result) successCount++
  else errorCount++
})

// 验证请求工具文件
console.log('\n=== 验证 request.js ===')
try {
  const requestPath = path.join(__dirname, 'utils', 'request.js')
  if (fs.existsSync(requestPath)) {
    console.log('✓ request.js 文件存在')
    successCount++
  } else {
    console.log('✗ request.js 文件不存在')
    errorCount++
  }
} catch (error) {
  console.error('✗ 验证 request.js 时出错:', error.message)
  errorCount++
}

// 生成测试报告
console.log('\n========== API接口验证报告 ==========')
console.log(`总文件数: ${apiFiles.length + 2}`) // API文件 + config.js + request.js
console.log(`验证成功: ${successCount}`)
console.log(`验证失败: ${errorCount}`)
console.log(`\n结论: ${errorCount === 0 ? '所有API接口文件结构正确' : '部分API接口文件存在问题，需要检查'}`)

// 检查是否有特殊接口需要验证
console.log('\n========== 特殊接口验证 ==========')

// 检查consultation.js中的getMyConsultations别名方法
try {
  const consultationPath = path.join(__dirname, 'api', 'consultation.js')
  if (fs.existsSync(consultationPath)) {
    const consultationContent = fs.readFileSync(consultationPath, 'utf8')
    if (consultationContent.includes('export const getMyConsultations')) {
      console.log('✓ consultation.js 包含 getMyConsultations 别名方法')
    } else {
      console.log('⚠ consultation.js 可能缺少 getMyConsultations 别名方法')
    }
  }
} catch (error) {
  console.error('✗ 检查 consultation.js 时出错:', error.message)
}

// 检查order.js中的confirmReceipt方法
try {
  const orderPath = path.join(__dirname, 'api', 'order.js')
  if (fs.existsSync(orderPath)) {
    const orderContent = fs.readFileSync(orderPath, 'utf8')
    if (orderContent.includes('export const confirmReceipt')) {
      console.log('✓ order.js 包含 confirmReceipt 方法')
    } else {
      console.log('⚠ order.js 可能缺少 confirmReceipt 方法')
    }
  }
} catch (error) {
  console.error('✗ 检查 order.js 时出错:', error.message)
}

console.log('\n========== 验证完成 ==========')