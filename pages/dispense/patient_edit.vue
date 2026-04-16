<template>
  <view class="page">
    <view class="top-banner">隐私保护，以下信息仅对接诊医生可见</view>

    <view class="patient-typeTabs">
      <view class="type-label">就诊人类型</view>
      <view class="type-tab-group">
        <view
          class="type-tab"
          :class="{ active: formData.patientType === 'adult' }"
          @click="switchPatientType('adult')"
        >成人</view>
        <view
          class="type-tab"
          :class="{ active: formData.patientType === 'child' }"
          @click="switchPatientType('child')"
        >儿童（小于16岁）</view>
      </view>
    </view>

    <view class="form-section" v-if="formData.patientType === 'adult'">
      <view class="form-item">
        <view class="label"><text class="required">*</text> 就诊人姓名</view>
        <input class="input" v-model="formData.name" placeholder="必填，请输入真实姓名" maxlength="20" />
      </view>

      <view class="form-item picker-item">
        <view class="label"><text class="required">*</text> 证件类型</view>
        <picker mode="selector" :range="idTypeOptions" :value="idTypeIndex" @change="onIdTypeChange">
          <view class="picker-value">{{ formData.idType || '请选择' }}</view>
        </picker>
        <text class="arrow">›</text>
      </view>

      <view class="form-item">
        <view class="label"><text class="required">*</text> 证件号码</view>
        <input
          class="input"
          v-model="formData.idNumber"
          placeholder="必填，请输入证件号码"
          maxlength="30"
        />
      </view>

      <view class="form-item">
        <view class="label"><text class="required">*</text> 手机号码</view>
        <input
          class="input"
          v-model="formData.phone"
          type="number"
          placeholder="必填，请输入手机号码"
          maxlength="11"
        />
      </view>

      <view class="form-item picker-item">
        <view class="label"><text class="required">*</text> 家庭地址</view>
        <picker
          mode="multiSelector"
          :range="multiRange"
          :value="multiValue"
          @columnchange="onMultiColumnChange"
          @change="onMultiChange"
        >
          <view class="picker-value">
            {{ formData.regionText || '请选择省/市/区/街道' }}
          </view>
        </picker>
        <text class="arrow">›</text>
      </view>

      <view class="form-item detail-item">
        <view class="label">详细地址</view>
        <input
          class="input"
          v-model="formData.detailAddress"
          placeholder="详细地址，如：江南路花园小区5栋1单元501室"
          maxlength="80"
        />
      </view>
    </view>

    <view class="form-section child-section" v-else>
      <view class="form-item">
        <view class="label"><text class="required">*</text> 就诊人姓名</view>
        <input class="input" v-model="formData.name" placeholder="必填，请输入真实姓名" maxlength="20" />
      </view>

      <view class="form-item picker-item">
        <view class="label"><text class="required">*</text> 证件类型</view>
        <picker mode="selector" :range="idTypeOptions" :value="idTypeIndex" @change="onIdTypeChange">
          <view class="picker-value">{{ formData.idType || '请选择' }}</view>
        </picker>
        <text class="arrow">›</text>
      </view>

      <view class="form-item">
        <view class="label"><text class="required">*</text> 证件号码</view>
        <input
          class="input"
          v-model="formData.idNumber"
          placeholder="必填，请输入证件号码"
          maxlength="30"
        />
      </view>

      <view class="form-item gender-item">
        <view class="label"><text class="required">*</text> 性别</view>
        <view class="gender-options">
          <view
            class="gender-tag"
            :class="{ checked: formData.gender === '男' }"
            @click="formData.gender = '男'"
          >
            男
          </view>
          <view
            class="gender-tag"
            :class="{ checked: formData.gender === '女' }"
            @click="formData.gender = '女'"
          >
            女
          </view>
        </view>
      </view>

      <view class="form-item picker-item">
        <view class="label"><text class="required">*</text> 出生日期</view>
        <picker mode="date" :value="formData.birthDate" @change="onBirthDateChange">
          <view class="picker-value">{{ formData.birthDate || '必填，请选择' }}</view>
        </picker>
        <text class="arrow">›</text>
      </view>

      <view class="form-item picker-item">
        <view class="label"><text class="required">*</text> 家庭地址</view>
        <picker
          mode="multiSelector"
          :range="multiRange"
          :value="multiValue"
          @columnchange="onMultiColumnChange"
          @change="onMultiChange"
        >
          <view class="picker-value">
            {{ formData.regionText || '请选择省/市/区/街道' }}
          </view>
        </picker>
        <text class="arrow">›</text>
      </view>

      <view class="form-item detail-item">
        <view class="label">详细地址</view>
        <input
          class="input"
          v-model="formData.detailAddress"
          placeholder="详细地址，如：江南路花园小区5栋1单元501室"
          maxlength="80"
        />
      </view>
    </view>

    <view class="form-section guardian-section" v-if="formData.patientType === 'child'">
      <view class="section-title">陪诊人信息</view>
      <view class="form-item">
        <view class="label">陪诊人姓名</view>
        <input
          class="input"
          v-model="formData.guardianName"
          placeholder="请填写陪诊人姓名"
          maxlength="20"
        />
      </view>
      <view class="form-item picker-item picker-item-left">
        <view class="label">证件类型</view>
        <picker
          mode="selector"
          :range="idTypeOptions"
          :value="guardianIdTypeIndex"
          @change="onGuardianIdTypeChange"
        >
          <view class="picker-value picker-value-left">{{ formData.guardianIdType || '请选择' }}</view>
        </picker>
        <text class="arrow">›</text>
      </view>
      <view class="form-item">
        <view class="label">证件号码</view>
        <input
          class="input"
          v-model="formData.guardianIdNumber"
          placeholder="请填写证件号码"
          maxlength="30"
        />
      </view>
      <view class="form-item">
        <view class="label">手机号码</view>
        <input
          class="input"
          v-model="formData.guardianPhone"
          type="number"
          placeholder="请填写手机号码"
          maxlength="11"
        />
      </view>
    </view>

    <view class="footer">
      <button class="save-btn" @click="handleSubmit">保存</button>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { addPatient } from '@/api/patient.js'
import { STORAGE_KEY_USER_REGISTER } from '@/utils/storage.js'
import { deriveGenderFromId, deriveAgeFromId } from '@/utils/patient.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { getImageUrl } from '@/utils/config.js'

const idTypeOptions = ['身份证', '护照', '港澳通行证', '台胞证']

const extractBirthFromId = (idNumber = '') => {
  if (!/^\d{17}[\dXx]$/.test(idNumber)) return ''
  const y = idNumber.slice(6, 10)
  const m = idNumber.slice(10, 12)
  const d = idNumber.slice(12, 14)
  return `${y}-${m}-${d}`
}

const formData = reactive({
  name: '',
  gender: '男',
  birthDate: '',
  idType: '身份证',
  idNumber: '',
  age: 0,
  phone: '',
  regionText: '',
  province: '',
  city: '',
  district: '',
  street: '',
  detailAddress: '',
  patientType: 'adult',
  guardianName: '',
  guardianIdType: '身份证',
  guardianIdNumber: '',
  guardianPhone: ''
})

const idTypeIndex = ref(0)
const guardianIdTypeIndex = ref(0)
const multiRange = ref([[], [], [], []])
const multiValue = ref([0, 0, 0, 0])
const DISTRICT_PLACEHOLDER = '请选择区/县'
const STREET_PLACEHOLDER = '请选择街道'
const REGION_DATA = ref([])
const REGION_DATA_URL = '/profile/liaoning_zongyi/data/pcas-code.json'

// 异步加载省市区街道数据（从远程 JSON，而不是打包进主包）
const initRegionData = () => {
  return new Promise((resolve) => {
    if (REGION_DATA.value && REGION_DATA.value.length > 0) {
      resolve()
      return
    }
    uni.request({
      url: getImageUrl(REGION_DATA_URL),
      method: 'GET',
      success: (res) => {
        if (Array.isArray(res.data)) {
          REGION_DATA.value = res.data
        } else {
          REGION_DATA.value = []
        }
        resolve()
      },
      fail: (err) => {
        console.error('加载区域数据失败:', err)
        REGION_DATA.value = []
        resolve()
      }
    })
  })
}

const updateFieldsFromId = () => {
  if (formData.idType === '身份证') {
    formData.gender = deriveGenderFromId(formData.idNumber)
    formData.age = deriveAgeFromId(formData.idNumber)
    const birth = extractBirthFromId(formData.idNumber)
    if (birth) formData.birthDate = birth
  }
}

watch(
  () => formData.idNumber,
  () => {
    updateFieldsFromId()
  }
)

const onIdTypeChange = (event) => {
  const index = Number(event.detail.value || 0)
  idTypeIndex.value = index
  formData.idType = idTypeOptions[index]
  if (formData.idType !== '身份证') {
    formData.age = 0
  } else {
    updateFieldsFromId()
  }
}

const onGuardianIdTypeChange = (event) => {
  const index = Number(event.detail.value || 0)
  guardianIdTypeIndex.value = index
  formData.guardianIdType = idTypeOptions[index]
}

const resetForm = () => {
  formData.name = ''
  formData.gender = '男'
  formData.birthDate = ''
  formData.idType = '身份证'
  formData.idNumber = ''
  formData.age = 0
  formData.phone = ''
  formData.regionText = ''
  formData.province = ''
  formData.city = ''
  formData.district = ''
  formData.street = ''
  formData.detailAddress = ''
  formData.patientType = 'adult'
  formData.guardianName = ''
  formData.guardianIdType = '身份证'
  formData.guardianIdNumber = ''
  formData.guardianPhone = ''
  idTypeIndex.value = 0
  guardianIdTypeIndex.value = 0
  multiValue.value = [0, 0, 0, 0]
  initGuardianInfo()
  setDefaultRegion()
}

onLoad(async () => {
  await initRegionData()
  resetForm()
})

const switchPatientType = (type) => {
  formData.patientType = type
  if (type === 'child') {
    initGuardianInfo()
  }
}

const initGuardianInfo = () => {
  const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER) || {}
  formData.guardianName = userInfo.name || userInfo.realName || ''
  formData.guardianIdNumber = userInfo.idNumber || userInfo.idCard || ''
  formData.guardianPhone = userInfo.phone || userInfo.mobile || ''
  const idType = userInfo.idType || userInfo.idCardType
  const idx = idTypeOptions.indexOf(idType)
  if (idx >= 0) {
    guardianIdTypeIndex.value = idx
    formData.guardianIdType = idType
  }
}

const setDefaultRegion = (provinceName = '辽宁省', cityName = '沈阳市') => {
  const provinces = REGION_DATA.value || []
  const pIndex = Math.max(0, provinces.findIndex(p => p.name === provinceName))
  const province = provinces[pIndex] || {}
  const cities = province.children || []
  const cIndex = Math.max(0, cities.findIndex(c => c.name === cityName))
  const dIndex = 0 // 默认选占位“请选择区/县”
  const sIndex = 0 // 默认选占位“请选择街道”
  const value = [pIndex, cIndex, dIndex, sIndex]
  multiValue.value = value
  buildMultiRange()
  const provinceNameText = provinces[pIndex]?.name || ''
  const cityNameText = cities[cIndex]?.name || ''
  formData.province = provinceNameText
  formData.city = cityNameText
  formData.district = ''
  formData.street = ''
  formData.regionText = [provinceNameText, cityNameText].filter(Boolean).join(' ')
}

const buildMultiRange = () => {
  const provinces = REGION_DATA.value.map(p => p.name)
  let pIndex = multiValue.value[0] || 0
  if (pIndex < 0 || pIndex >= provinces.length) pIndex = 0

  const province = REGION_DATA.value[pIndex] || {}
  const cities = (province.children || []).map(c => c.name)
  let cIndex = multiValue.value[1] || 0
  if (cIndex < 0 || cIndex >= cities.length) cIndex = 0

  const city = (province.children || [])[cIndex] || {}
  const districtNames = (city.children || []).map(d => d.name)
  const districts = [DISTRICT_PLACEHOLDER, ...districtNames]
  let dIndex = multiValue.value[2] || 0
  if (dIndex < 0 || dIndex >= districts.length) dIndex = 0

  const district = (city.children || [])[dIndex - 1] || {}
  const streets = (district.children || []).map(s => s.name)
  const streetList = dIndex === 0 ? [STREET_PLACEHOLDER] : streets.length > 0 ? streets : [STREET_PLACEHOLDER]
  let sIndex = multiValue.value[3] || 0
  if (sIndex < 0 || sIndex >= streetList.length) sIndex = 0

  multiRange.value = [provinces, cities, districts, streetList]
  multiValue.value = [pIndex, cIndex, dIndex, sIndex]
}

const onMultiColumnChange = (event) => {
  const { column, value } = event.detail || {}
  const newValue = [...multiValue.value]
  newValue[column] = value
  if (column === 0) {
    newValue[1] = 0
    newValue[2] = 0
    newValue[3] = 0
  } else if (column === 1) {
    newValue[2] = 0
    newValue[3] = 0
  } else if (column === 2) {
    newValue[3] = 0
  }
  multiValue.value = newValue
  buildMultiRange()
}

const onMultiChange = (event) => {
  const value = event.detail?.value || [0, 0, 0, 0]
  multiValue.value = value
  const [pIndex, cIndex, dIndex, sIndex] = value
  const [provinces, cities, districts, streets] = multiRange.value
  formData.province = provinces[pIndex] || ''
  formData.city = cities[cIndex] || ''
  const district = districts[dIndex] || ''
  formData.district = district === DISTRICT_PLACEHOLDER ? '' : district
  const street = streets[sIndex] || ''
  formData.street = street === STREET_PLACEHOLDER ? '' : street
  formData.regionText = [formData.province, formData.city, formData.district, formData.street]
    .filter(Boolean)
    .join(' ')
}

const onBirthDateChange = (event) => {
  formData.birthDate = event.detail?.value || ''
}

const validateForm = () => {
  if (!formData.name.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return false
  }
  if (!formData.idNumber.trim()) {
    uni.showToast({ title: '请输入证件号码', icon: 'none' })
    return false
  }
  if (formData.idType === '身份证' && !/^\d{17}[\dXx]$/.test(formData.idNumber)) {
    uni.showToast({ title: '身份证格式不正确', icon: 'none' })
    return false
  }
  if (formData.patientType === 'adult') {
    if (!formData.phone.trim()) {
      uni.showToast({ title: '请输入手机号码', icon: 'none' })
      return false
    }
    if (!/^1[3-9]\d{9}$/.test(formData.phone.trim())) {
      uni.showToast({ title: '手机号格式不正确', icon: 'none' })
      return false
    }
  }
  if (!formData.regionText || !formData.district || !formData.street) {
    uni.showToast({ title: '请选择完整的家庭地址', icon: 'none' })
    return false
  }
  if (!formData.detailAddress.trim()) {
    uni.showToast({ title: '请输入详细地址', icon: 'none' })
    return false
  }
  if (formData.patientType === 'child') {
    if (!formData.birthDate) {
      uni.showToast({ title: '请选择出生日期', icon: 'none' })
      return false
    }
    if (!formData.guardianName.trim()) {
      uni.showToast({ title: '请输入陪诊人姓名', icon: 'none' })
      return false
    }
    if (!formData.guardianIdNumber.trim()) {
      uni.showToast({ title: '请输入陪诊人证件号', icon: 'none' })
      return false
    }
    if (!formData.guardianPhone.trim()) {
      uni.showToast({ title: '请输入陪诊人手机号', icon: 'none' })
      return false
    }
    if (!/^1[3-9]\d{9}$/.test(formData.guardianPhone.trim())) {
      uni.showToast({ title: '陪诊人手机号格式不正确', icon: 'none' })
      return false
    }
  }
  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return
  
  logButtonClick('保存就诊人', 'PATIENT_EDIT', '', {
    patientType: formData.patientType || 'adult',
    name: formData.name
  })
  
  try {
    uni.showLoading({ title: '保存中...' })
    const patientType = formData.patientType || 'adult'
    const payload = {
      name: formData.name.trim(),
      gender: formData.gender || '未知',
      age: formData.age || 0,
      birthDate: formData.birthDate || null,
      idType: formData.idType || '身份证',
      idNumber: formData.idNumber.trim(),
      phone: formData.phone ? formData.phone.trim() : null,
      patientType: patientType,
      province: formData.province || '',
      city: formData.city || '',
      district: formData.district || '',
      street: formData.street || '',
      detailAddress: formData.detailAddress.trim()
    }
    // 只有儿童类型才提交陪诊人信息
    if (patientType === 'child') {
      payload.guardianName = formData.guardianName ? formData.guardianName.trim() : null
      payload.guardianIdType = formData.guardianIdType || null
      payload.guardianIdNumber = formData.guardianIdNumber ? formData.guardianIdNumber.trim() : null
      payload.guardianPhone = formData.guardianPhone ? formData.guardianPhone.trim() : null
    }
    await addPatient(payload)
    uni.$emit('patientChanged')
    uni.hideLoading()
    uni.showToast({ title: '添加成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1200)
  } catch (error) {
    console.error('保存就诊人失败:', error)
    uni.hideLoading()
    const errMsg = error?.message || error?.data?.message || '保存失败，请稍后再试'
    uni.showToast({ title: errMsg, icon: 'none' })
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7fb;
  padding: 20rpx;
  padding-bottom: 200rpx; /* 留出固定底部按钮空间，避免内容被遮挡 */
  box-sizing: border-box;
}

.top-banner {
  background: #fff7e6;
  color: #ff9b00;
  font-size: 24rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.patient-typeTabs {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.type-label {
  font-size: 28rpx;
  color: #333;
  min-width: 160rpx;
}

.type-tab-group {
  display: flex;
  flex: 1;
  gap: 20rpx;
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 999rpx;
  background: #f0f2f7;
  font-size: 28rpx;
  color: #666;
}

.type-tab.active {
  background: #2a82e4;
  color: #fff;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  width: 200rpx;
  font-size: 28rpx;
  color: #333;
}

.required {
  color: #ff4d4f;
  margin-right: 6rpx;
}

.input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.picker-item {
  justify-content: flex-start;
}

.picker-value {
  flex: 1;
  text-align: left;
  font-size: 28rpx;
  color: #333;
}

.picker-item .picker-value {
  text-align: left;
}

.picker-item .arrow {
  margin-left: auto;
}

.picker-value-left {
  text-align: left;
}

.arrow {
  font-size: 32rpx;
  color: #999;
  margin-left: 12rpx;
}

.static {
  flex: 1;
  text-align: left;
  font-size: 28rpx;
  color: #666;
}

.gender-item {
  align-items: center;
}

.gender-options {
  display: flex;
  gap: 20rpx;
}

.gender-tag {
  min-width: 100rpx;
  text-align: center;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #f0f2f7;
  color: #333;
  font-size: 28rpx;
}

.gender-tag.checked {
  background: #2a82e4;
  color: #fff;
}

.child-section {
  margin-top: 20rpx;
}

.guardian-section {
  margin-top: 24rpx;
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -6rpx 20rpx rgba(0, 0, 0, 0.06);
  z-index: 10; /* 确保固定按钮在最上层，防止输入内容覆盖 */
}

.save-btn {
  width: 100%;
  background: #2a82e4;
  color: #fff;
  font-size: 30rpx;
  padding: 16rpx 0;
  border-radius: 50rpx;
  border: none;
}
</style>

