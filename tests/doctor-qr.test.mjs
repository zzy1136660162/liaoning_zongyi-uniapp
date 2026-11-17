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

const createConsultation = (overrides = {}) => {
  const calls = []; let mounted, unmounted
  const state = loadSetup('components/DoctorConsultation.vue', {
    ref: value => ({ value }), nextTick: async () => {}, defineEmits: () => () => {},
    onMounted: callback => { mounted = callback }, onUnmounted: callback => { unmounted = callback },
    getConsultationDoctors: () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    getImageUrl: value => value, saveDoctorQr,
    ...overrides
  }, ['selected', 'loading', 'loadError', 'loadDoctors', 'imageLoading', 'imageFailed', 'imageVisible',
    'onImageLoad', 'onImageError', 'retryImage', 'save', 'saving', 'preview', 'close'])
  return { state, calls, mounted, unmounted }
}

test('咨询加载失败可重试，自动展示一位，关闭后迟到响应不恢复弹层', async () => {
  const { state, calls, mounted, unmounted } = createConsultation()
  const first = mounted(); calls[0].reject(new Error('network')); await first
  assert.match(state.loadError.value, /加载失败/)
  const retry = state.loadDoctors(); calls[1].resolve([{ id: 1, name: '测试医生', consultationQrUrl: '/profile/qr.png' }]); await retry
  assert.equal(state.selected.value.id, 1)
  assert.equal(state.imageLoading.value, true)
  assert.equal(state.loadError.value, '')
  const late = state.loadDoctors()
  await state.loadDoctors()
  assert.equal(calls.length, 3, '加载中重复点击不发第二个请求')
  unmounted(); calls[2].resolve([{ id: 2 }]); await late
  assert.equal(state.selected.value, null)
})

test('每次打开重新获取名单，随机覆盖所有人员类型，允许再次选中同一人', async () => {
  const people = [{ id: 1, personType: 1 }, { id: 2, personType: 2 }, { id: 3, personType: 9 }]
  let requests = 0
  for (const [random, id] of [[0, 1], [0.5, 2], [0.999, 3], [0.999, 3]]) {
    const { state, mounted, unmounted } = createConsultation({
      Math: { random: () => random, floor: Math.floor },
      getConsultationDoctors: async () => { requests++; return people }
    })
    await mounted()
    assert.equal(state.selected.value.id, id)
    unmounted()
  }
  assert.equal(requests, 4)
})

test('无候选人员时不展示旧二维码，也不触发预览或保存', async () => {
  const { state, calls, mounted } = createConsultation({
    saveDoctorQr: () => assert.fail('空名单不得保存'),
    uni: { previewImage: () => assert.fail('空名单不得预览') }
  })
  const initial = mounted(); calls[0].resolve([{ id: 1 }]); await initial
  for (const result of [[], null]) {
    const request = state.loadDoctors(); calls.at(-1).resolve(result); await request
    assert.equal(state.selected.value, null)
    assert.equal(state.loading.value, false)
    assert.equal(state.loadError.value, '')
    await state.save()
    state.preview()
  }
})

test('二维码未就绪或加载失败不能保存，重试保留当前人员，保存防重复且成功后才提示', async () => {
  const saved = [], toasts = [], previews = [], closes = []
  let finishSave
  const { state, calls, mounted } = createConsultation({
    saveDoctorQr: url => { saved.push(url); return new Promise(resolve => { finishSave = resolve }) },
    defineEmits: () => event => closes.push(event),
    uni: { showToast: value => toasts.push(value), previewImage: value => previews.push(value) }
  })
  const first = mounted(); calls[0].resolve([{ id: 2, consultationQrUrl: 'https://fixture.invalid/pharmacist.png' }]); await first
  await state.save(); state.preview()
  state.onImageError()
  await state.save(); state.preview()
  assert.equal(saved.length, 0)
  assert.equal(previews.length, 0)
  const retry = state.retryImage()
  assert.equal(state.imageVisible.value, false, '重试先卸载失败的原生图片')
  await retry
  assert.equal(state.selected.value.id, 2)
  assert.equal(state.imageVisible.value, true)
  assert.equal(state.imageLoading.value, true)
  assert.equal(state.imageFailed.value, false)
  state.onImageLoad()
  state.preview()
  assert.deepEqual(previews[0].urls, ['https://fixture.invalid/pharmacist.png'])
  const saving = state.save()
  await state.save(); state.close()
  assert.deepEqual(saved, ['https://fixture.invalid/pharmacist.png'])
  assert.equal(closes.length, 0)
  assert.equal(toasts.length, 0)
  finishSave(); await saving
  assert.equal(state.saving.value, false)
  assert.equal(toasts[0].title, '已保存到相册')
  state.close()
  assert.deepEqual(closes, ['close'])
})

test('长按保存被拒绝时保留二维码并引导授权，关闭后保存结果不弹提示', async () => {
  const modals = [], toasts = [], settings = []
  const { state, calls, mounted, unmounted } = createConsultation({
    saveDoctorQr: async () => { throw Object.assign(new Error('请允许保存图片到相册后重试'), { permissionDenied: true }) },
    uni: { showToast: value => toasts.push(value), showModal: value => modals.push(value), openSetting: value => settings.push(value) }
  })
  const first = mounted(); calls[0].resolve([{ id: 2, consultationQrUrl: 'https://fixture.invalid/qr.png' }]); await first
  state.onImageLoad()
  await state.save()
  assert.equal(state.selected.value.id, 2)
  assert.equal(state.saving.value, false)
  assert.equal(toasts.length, 0)
  assert.equal(modals[0].confirmText, '去设置')
  modals[0].success({ confirm: true })
  assert.equal(settings.length, 1)
  const late = state.save(); unmounted(); await late
  assert.equal(modals.length, 1)
  assert.equal(toasts.length, 0)
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
