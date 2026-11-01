import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveDoctorQr } from '../utils/doctor-qr.js'
import { loadSetup, loadOptions } from './sfc-harness.mjs'

test('保存二维码先确认下载成功再写相册，失败或拒绝授权不误报成功', async () => {
  let downloads = [], saves = []
  globalThis.uni = { downloadFile: value => downloads.push(value), saveImageToPhotosAlbum: value => saves.push(value) }
  const first = saveDoctorQr('https://fixture.invalid/qr.png')
  assert.equal(saves.length, 0)
  downloads[0].success({ statusCode: 200, tempFilePath: 'wxfile://fixture.png' })
  await Promise.resolve()
  assert.equal(saves[0].filePath, 'wxfile://fixture.png')
  saves[0].success({}); await first
  const failed = saveDoctorQr('https://fixture.invalid/qr.png')
  downloads[1].success({ statusCode: 404, tempFilePath: 'error' })
  await assert.rejects(failed, /下载失败/)
  assert.equal(saves.length, 1)
  const denied = saveDoctorQr('https://fixture.invalid/qr.png')
  downloads[2].success({ statusCode: 200, tempFilePath: 'wxfile://fixture.png' }); await Promise.resolve()
  saves[1].fail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' })
  await assert.rejects(denied, error => error.permissionDenied === true)
  const privacy = saveDoctorQr('https://fixture.invalid/qr.png')
  downloads[3].success({ statusCode: 200, tempFilePath: 'wxfile://fixture.png' }); await Promise.resolve()
  saves[2].fail({ errMsg: 'saveImageToPhotosAlbum:fail privacy permission denied' })
  await assert.rejects(privacy, error => !error.permissionDenied && /隐私授权/.test(error.message))
})

test('医生加载错误可重试，先选医生，卸载后迟到响应不恢复弹层', async () => {
  const calls = []; let mounted, unmounted
  const state = loadSetup('components/DoctorConsultation.vue', {
    ref: value => ({ value }), defineEmits: () => () => {},
    onMounted: callback => { mounted = callback }, onUnmounted: callback => { unmounted = callback },
    getConsultationDoctors: () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    getImageUrl: value => value, saveDoctorQr
  }, ['doctors', 'selected', 'loading', 'loadError', 'loadDoctors', 'selectDoctor'])
  const first = mounted(); calls[0].reject(new Error('network')); await first
  assert.match(state.loadError.value, /加载失败/)
  const retry = state.loadDoctors(); calls[1].resolve([{ id: 1, name: '测试医生', consultationQrUrl: '/profile/qr.png' }]); await retry
  assert.equal(state.selected.value, null)
  state.selectDoctor(state.doctors.value[0]); assert.equal(state.selected.value.id, 1)
  const late = state.loadDoctors(); unmounted(); calls[2].resolve([{ id: 2 }]); await late
  assert.equal(state.doctors.value[0].id, 1)
})

test('仅浏览在未勾选和倒计时期间仍进入公开商品列表，不冒充复诊确认', () => {
  const targets = []
  const page = loadOptions('pages/notice/notice.vue', { redirectToWithFallback: value => targets.push(value) })
  const state = { ...page.data(), ...page.methods }
  state.handleBrowse()
  assert.deepEqual(targets, ['/pages/products/medicine_list'])
  assert.equal(state.isChecked, false)
  assert.equal(state.isCountdownFinished, false)
})
