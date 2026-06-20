import assert from 'node:assert/strict'
import { parseUploadResponse } from '../api/common.js'

const parsed = parseUploadResponse({
  statusCode: 200,
  data: JSON.stringify({
    code: 200,
    message: '操作成功',
    data: {
      url: '/profile/upload/2026/06/a.jpg',
      fileName: 'a.jpg'
    }
  })
})

assert.equal(parsed.url, '/profile/upload/2026/06/a.jpg')

assert.throws(() => parseUploadResponse({
  statusCode: 200,
  data: JSON.stringify({ code: 500, message: '上传失败', data: null })
}), /上传失败/)

assert.throws(() => parseUploadResponse({
  statusCode: 500,
  data: ''
}), /上传失败/)
