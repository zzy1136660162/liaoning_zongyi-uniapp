<template>
  <view class="consult-mask" @click.self="close">
    <view class="consult-sheet" @click.stop>
      <view class="consult-heading">
        <text class="consult-title">{{ selected ? '医生问诊二维码' : '选择咨询医生' }}</text>
        <button class="consult-close" aria-label="关闭" @click="close">×</button>
      </view>
      <view v-if="loading" class="consult-state">正在加载医生…</view>
      <view v-else-if="loadError" class="consult-state">
        <text>{{ loadError }}</text>
        <button class="consult-retry" @click="loadDoctors">重新加载</button>
      </view>
      <view v-else-if="!doctors.length" class="consult-state">暂未开放医生线上咨询，请稍后再试。</view>
      <scroll-view v-else-if="!selected" scroll-y class="consult-doctors">
        <button v-for="doctor in doctors" :key="doctor.id" class="consult-doctor" @click="selectDoctor(doctor)">
          <image v-if="doctor.avatarUrl" class="consult-avatar" :src="getImageUrl(doctor.avatarUrl)" mode="aspectFill" />
          <view v-else class="consult-avatar consult-avatar-empty">医</view>
          <view class="consult-doctor-info">
            <view><text class="consult-name">{{ doctor.name }}</text><text class="consult-job">{{ doctor.title }}</text></view>
            <text class="consult-department">{{ [doctor.department, doctor.hospitalName].filter(Boolean).join(' · ') }}</text>
          </view>
          <text class="consult-arrow">›</text>
        </button>
      </scroll-view>
      <view v-else class="consult-code">
        <text class="consult-name">{{ selected.name }}<text class="consult-job">{{ selected.title }}</text></text>
        <text class="consult-department">{{ selected.department }}</text>
        <image class="consult-qr" :src="getImageUrl(selected.consultationQrUrl)" mode="aspectFit" @click="preview" @error="imageFailed = true" @load="imageFailed = false" />
        <text v-if="imageFailed" class="consult-error">二维码加载失败，请重新选择或稍后重试。</text>
        <text class="consult-tip">保存后，打开微信扫一扫，从相册选择二维码进入医生页面。</text>
        <button class="consult-save" :loading="saving" :disabled="saving || imageFailed" @click="save">保存到相册</button>
        <button class="consult-change" :disabled="saving" @click="selected = null">重新选择医生</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getConsultationDoctors } from '@/api/doctor.js'
import { getImageUrl } from '@/utils/config.js'
import { saveDoctorQr } from '@/utils/doctor-qr.js'

const emit = defineEmits(['close'])
const doctors = ref([])
const selected = ref(null)
const loading = ref(false)
const loadError = ref('')
const imageFailed = ref(false)
const saving = ref(false)
let disposed = false

const close = () => { if (!saving.value) emit('close') }
const loadDoctors = async () => {
  if (loading.value || disposed) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await getConsultationDoctors()
    if (!disposed) doctors.value = Array.isArray(result) ? result : []
  } catch (_) {
    if (!disposed) loadError.value = '医生列表加载失败，请重试。'
  } finally {
    if (!disposed) loading.value = false
  }
}
const selectDoctor = doctor => {
  imageFailed.value = false
  selected.value = doctor
}
const preview = () => {
  if (selected.value && !imageFailed.value) uni.previewImage({ urls: [getImageUrl(selected.value.consultationQrUrl)] })
}
const save = async () => {
  if (saving.value || !selected.value || imageFailed.value) return
  saving.value = true
  try {
    await saveDoctorQr(getImageUrl(selected.value.consultationQrUrl))
    if (!disposed) uni.showToast({ title: '已保存到相册', icon: 'success' })
  } catch (error) {
    if (disposed) return
    if (error.permissionDenied) {
      uni.showModal({
        title: '需要相册权限', content: error.message, confirmText: '去设置',
        success: result => { if (result.confirm && !disposed) uni.openSetting({}) }
      })
    } else uni.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
  } finally {
    if (!disposed) saving.value = false
  }
}
onMounted(loadDoctors)
onUnmounted(() => { disposed = true })
</script>

<style scoped>
.consult-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1100; background: rgba(20, 35, 50, .38); display: flex; align-items: flex-end; }
.consult-sheet { width: 100%; max-height: 86vh; box-sizing: border-box; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); }
.consult-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.consult-title { font-size: 32rpx; font-weight: 600; color: #263c4a; }
.consult-close { width: 72rpx; height: 72rpx; margin: -10rpx -12rpx 0 0; padding: 0; line-height: 72rpx; background: transparent; color: #7b8791; font-size: 42rpx; }
button::after { border: 0; }
.consult-state { padding: 52rpx 12rpx; text-align: center; color: #7b8791; font-size: 27rpx; }
.consult-doctors { max-height: 58vh; }
.consult-doctor { display: flex; align-items: center; width: 100%; padding: 24rpx 0; margin: 0; border-radius: 0; border-bottom: 1rpx solid #edf0f3; background: #fff; text-align: left; line-height: 1.5; }
.consult-avatar { width: 76rpx; height: 76rpx; border-radius: 50%; margin-right: 22rpx; flex-shrink: 0; }
.consult-avatar-empty { background: #edf4f7; color: #377b9b; text-align: center; line-height: 76rpx; font-size: 28rpx; }
.consult-doctor-info { flex: 1; min-width: 0; }
.consult-name { font-size: 30rpx; color: #263c4a; font-weight: 600; }
.consult-job { margin-left: 16rpx; font-size: 24rpx; font-weight: 400; color: #71818e; }
.consult-department { display: block; margin-top: 8rpx; font-size: 24rpx; color: #85919b; }
.consult-arrow { padding-left: 16rpx; color: #9aa4ad; }
.consult-code { text-align: center; }
.consult-qr { display: block; width: 360rpx; height: 360rpx; max-height: 32vh; margin: 22rpx auto; }
.consult-tip, .consult-error { display: block; max-width: 560rpx; margin: 12rpx auto; color: #85919b; font-size: 24rpx; line-height: 1.65; }
.consult-error { color: #b65c42; }
.consult-save { width: 360rpx; height: 76rpx; line-height: 76rpx; margin: 24rpx auto 8rpx; border-radius: 12rpx; background: #377b9b; color: #fff; font-size: 28rpx; }
.consult-change, .consult-retry { width: auto; display: inline-block; background: transparent; color: #377b9b; font-size: 25rpx; padding: 10rpx 24rpx; }
</style>
