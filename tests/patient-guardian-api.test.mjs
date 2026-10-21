import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as patients from '../utils/patient.js'
import { loadSetup } from './sfc-harness.mjs'

const guardianFields = ['guardianName', 'guardianIdType', 'guardianIdNumber', 'guardianPhone']
const profile = suffix => ({ id: 7, userName: `接口监护人${suffix}`, idType: '护照', idCardNo: `PASSPORT-${suffix}`, phone: '13800138000' })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const blankGuardian = page => guardianFields.every(field => page.formData[field] === '')

const createPage = async () => {
  let generation = 1, storageReads = 0
  const hooks = {}, requests = [], toasts = []
  const page = loadSetup('pages/dispense/patient_edit.vue', {
    ...patients,
    ref: value => ({ value }), reactive: value => value,
    computed: get => ({ get value() { return get() } }), watch() {},
    onLoad: hook => { hooks.load = hook }, onShow: hook => { hooks.show = hook },
    onHide: hook => { hooks.hide = hook }, onUnload: hook => { hooks.unload = hook },
    getSessionGeneration: () => generation, isCurrentSession: session => session === generation,
    fetchAccountProfile: () => {
      const request = deferred()
      requests.push(request)
      return request.promise
    },
    getImageUrl: value => value,
    uni: {
      request: options => options.success({ data: [] }),
      getStorageSync() { storageReads++; throw new Error('资料不能从缓存读取') },
      showToast: toast => toasts.push(toast), setNavigationBarTitle() {}
    }
  }, ['formData', 'patientId', 'initGuardianInfo', 'switchPatientType', 'markGuardianEdited'])
  await hooks.load({})
  return { ...page, hooks, requests, toasts, storageReads: () => storageReads,
    changeSession: () => { generation++ } }
}

test('儿童监护人只由实时账号 DTO 预填，成人页不请求资料或读取旧缓存', async () => {
  const page = await createPage()
  assert.equal(page.requests.length, 0)
  await page.hooks.show()
  assert.equal(page.requests.length, 0)
  const filling = page.switchPatientType('child')
  assert.equal(page.requests.length, 1)
  assert.equal(blankGuardian(page), true)
  page.requests[0].resolve({ ...profile('A'), realName: '旧字段', idNumber: '旧证件', mobile: '旧手机' })
  await filling
  assert.equal(page.formData.guardianName, '接口监护人A')
  assert.equal(page.formData.guardianIdType, '护照')
  assert.equal(page.formData.guardianIdNumber, 'PASSPORT-A')
  assert.equal(page.formData.guardianPhone, '13800138000')
  assert.equal(page.storageReads(), 0)
})

test('编辑已有就诊人及任一监护人字段已有输入时不发起账号预填', async () => {
  for (const field of guardianFields) {
    const page = await createPage()
    page.formData[field] = '已填内容'
    await page.switchPatientType('child')
    assert.equal(page.requests.length, 0, field)
    assert.equal(page.formData[field], '已填内容')
  }
  const page = await createPage()
  page.patientId.value = 8
  await page.switchPatientType('child')
  assert.equal(page.requests.length, 0)
})

test('请求等待期间任一监护人字段被填写，不回填其他字段或覆盖输入', async () => {
  for (const field of guardianFields) {
    const page = await createPage(), filling = page.switchPatientType('child')
    page.formData[field] = '手填内容'
    page.requests[0].resolve(profile('A'))
    await filling
    for (const current of guardianFields) assert.equal(page.formData[current], current === field ? '手填内容' : '')
  }
})

test('手填后主动清空也不会被迟到资料或再次预填覆盖', async () => {
  const page = await createPage(), filling = page.switchPatientType('child')
  page.formData.guardianName = '手填内容'
  page.markGuardianEdited()
  page.formData.guardianName = ''
  page.requests[0].resolve(profile('A'))
  await filling
  await page.initGuardianInfo()
  assert.equal(blankGuardian(page), true)
  assert.equal(page.requests.length, 1)
})

test('儿童切回成人使在途预填失效，再次选择儿童只接受最新接口结果', async () => {
  const page = await createPage(), old = page.switchPatientType('child')
  page.switchPatientType('adult')
  const latest = page.switchPatientType('child')
  assert.equal(page.requests.length, 2)
  page.requests[1].resolve(profile('B'))
  await latest
  page.requests[0].resolve(profile('A'))
  await old
  assert.equal(page.formData.guardianName, '接口监护人B')
})

test('隐藏、卸载、换账号或切到编辑状态后，迟到资料不回填', async () => {
  for (const invalidate of ['hide', 'unload', 'session', 'edit']) {
    const page = await createPage(), filling = page.switchPatientType('child')
    if (invalidate === 'session') page.changeSession()
    else if (invalidate === 'edit') page.patientId.value = 8
    else page.hooks[invalidate]()
    page.requests[0].resolve(profile('A'))
    await filling
    assert.equal(blankGuardian(page), true, invalidate)
    assert.equal(page.toasts.length, 0, invalidate)
  }
})

test('隐藏再返回发起新查询，旧请求不能抢先填入', async () => {
  const page = await createPage(), old = page.switchPatientType('child')
  page.hooks.hide()
  const latest = page.hooks.show()
  assert.equal(page.requests.length, 2)
  page.requests[0].resolve(profile('A'))
  await old
  assert.equal(blankGuardian(page), true)
  page.requests[1].resolve(profile('B'))
  await latest
  assert.equal(page.formData.guardianName, '接口监护人B')
})

test('资料接口失败只提示手动填写，不回退资料缓存且可重试', async () => {
  const page = await createPage(), filling = page.switchPatientType('child')
  page.requests[0].reject(new Error('请求失败'))
  await filling
  assert.equal(blankGuardian(page), true)
  assert.match(page.toasts.at(-1).title, /可手动填写/)
  assert.equal(page.storageReads(), 0)
  const retry = page.initGuardianInfo()
  assert.equal(page.requests.length, 2)
  page.requests[1].resolve(profile('B'))
  await retry
  assert.equal(page.formData.guardianName, '接口监护人B')
})
