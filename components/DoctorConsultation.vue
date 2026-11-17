<template>
  <view
    class="consult-mask"
    @click.self="close"
  >
    <view
      class="consult-sheet"
      @click.stop
    >
      <view class="consult-heading">
        <text class="consult-title">
          在线咨询
        </text>
        <button
          class="consult-close"
          aria-label="关闭咨询"
          :disabled="saving"
          @click="close"
        >
          ×
        </button>
      </view>
      <view
        v-if="loading"
        class="consult-state"
      >
        正在加载咨询人员…
      </view>
      <view
        v-else-if="loadError"
        class="consult-state"
      >
        <text>{{ loadError }}</text>
        <button
          class="consult-retry"
          @click="loadDoctors"
        >
          重新加载
        </button>
      </view>
      <view
        v-else-if="!selected"
        class="consult-state"
      >
        暂无可咨询人员，请稍后再试。
      </view>
      <template v-else>
        <scroll-view
          scroll-y
          class="consult-body"
        >
          <view class="consult-doctor">
            <image
              v-if="selected.avatarUrl"
              class="consult-avatar"
              :src="getImageUrl(selected.avatarUrl)"
              mode="aspectFill"
            />
            <view
              v-else
              class="consult-avatar consult-avatar-empty"
            >
              {{ selected.name.slice(0, 1) }}
            </view>
            <view class="consult-doctor-info">
              <view>
                <text class="consult-name">
                  {{ selected.name }}
                </text><text
                  v-if="selected.title"
                  class="consult-job"
                >
                  {{ selected.title }}
                </text>
              </view>
              <text
                v-if="selected.department"
                class="consult-department"
              >
                {{ selected.department }}
              </text>
              <text
                v-if="selected.hospitalName"
                class="consult-department"
              >
                {{ selected.hospitalName }}
              </text>
            </view>
          </view>
          <view class="consult-code">
            <view class="consult-qr-frame">
              <image
                v-if="imageVisible"
                class="consult-qr"
                :src="getImageUrl(selected.consultationQrUrl)"
                mode="widthFix"
                @longpress.stop="save"
                @error="onImageError"
                @load="onImageLoad"
              />
              <view
                v-if="imageLoading || imageFailed"
                class="consult-image-state"
              >
                <text>{{ imageFailed ? '二维码加载失败，请重试' : '二维码加载中…' }}</text>
                <button
                  v-if="imageFailed"
                  class="consult-retry"
                  @click="retryImage"
                >
                  重新加载
                </button>
              </view>
            </view>
            <text class="consult-hold-tip">
              长按二维码保存到相册
            </text>
            <button
              class="consult-preview"
              :disabled="saving || imageLoading || imageFailed"
              @click="preview"
            >
              查看大图
            </button>
          </view>
        </scroll-view>
        <view class="consult-footer">
          <text class="consult-tip">
            保存后，打开微信扫一扫，从相册选择二维码进入咨询页面。
          </text>
          <button
            class="consult-save"
            :loading="saving"
            :disabled="saving || imageLoading || imageFailed"
            @click="save"
          >
            {{ saving ? '正在保存…' : '保存二维码到相册' }}
          </button>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { getConsultationDoctors } from '@/api/doctor.js'
import { getImageUrl } from '@/utils/config.js'
import { saveDoctorQr } from '@/utils/doctor-qr.js'

const emit = defineEmits(['close'])
const props = defineProps({ productId: { type: [Number, String], default: null } })
const selected = ref(null)
const loading = ref(false)
const loadError = ref('')
const imageFailed = ref(false)
const imageLoading = ref(true)
const imageVisible = ref(false)
const saving = ref(false)
let disposed = false

const close = () => { if (!saving.value) emit('close') }
const loadDoctors = async () => {
  if (loading.value || disposed) return
  loading.value = true
  loadError.value = ''
  selected.value = null
  try {
    const result = await getConsultationDoctors(props.productId)
    if (disposed) return
    const doctors = Array.isArray(result) ? result : []
    if (doctors.length) {
      selected.value = doctors[Math.floor(Math.random() * doctors.length)]
      await retryImage()
    }
  } catch (_) {
    if (!disposed) loadError.value = '咨询人员加载失败，请检查网络后重试。'
  } finally {
    if (!disposed) loading.value = false
  }
}
const retryImage = async () => {
  imageFailed.value = false
  imageLoading.value = true
  // 同一地址加载失败后，先移除原生 image 再重建，确保小程序重新加载图片。
  imageVisible.value = false
  await nextTick()
  if (!disposed) imageVisible.value = true
}
const onImageLoad = () => {
  imageLoading.value = false
  imageFailed.value = false
}
const onImageError = () => {
  imageLoading.value = false
  imageFailed.value = true
}
const preview = () => {
  if (disposed || saving.value || !selected.value || imageLoading.value || imageFailed.value) return
  uni.previewImage({ urls: [getImageUrl(selected.value.consultationQrUrl)] })
}
const save = async () => {
  if (disposed || saving.value || !selected.value || imageLoading.value || imageFailed.value) return
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
.consult-sheet { display: flex; flex-direction: column; width: 100%; max-height: 90vh; box-sizing: border-box; background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom)); }
.consult-heading { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; padding-bottom: 16rpx; border-bottom: 1rpx solid #edf1f3; }
.consult-title { font-size: 32rpx; font-weight: 600; color: #263c4a; }
.consult-close { width: 72rpx; height: 72rpx; margin: -10rpx -12rpx 0 0; padding: 0; line-height: 72rpx; background: transparent; color: #7b8791; font-size: 42rpx; }
button::after { border: 0; }
.consult-state { padding: 64rpx 12rpx; text-align: center; color: #667986; font-size: 27rpx; }
.consult-body { height: 56vh; min-height: 0; flex-shrink: 1; }
.consult-footer { flex-shrink: 0; }
.consult-doctor { display: flex; align-items: center; padding: 28rpx 8rpx; text-align: left; line-height: 1.5; }
.consult-avatar { width: 88rpx; height: 88rpx; border-radius: 50%; margin-right: 22rpx; flex-shrink: 0; }
.consult-avatar-empty { background: #edf4f7; color: #377b9b; text-align: center; line-height: 88rpx; font-size: 32rpx; }
.consult-doctor-info { flex: 1; min-width: 0; }
.consult-name { font-size: 30rpx; color: #263c4a; font-weight: 600; }
.consult-job { margin-left: 16rpx; font-size: 24rpx; font-weight: 400; color: #71818e; }
.consult-department { display: block; margin-top: 6rpx; font-size: 24rpx; color: #667986; overflow-wrap: break-word; }
.consult-code { padding: 8rpx 0 16rpx; text-align: center; background: #f3f8f9; border-radius: 20rpx; }
.consult-qr-frame { position: relative; width: 480rpx; max-width: 100%; min-height: 320rpx; margin: 20rpx auto 16rpx; background: #fff; border: 12rpx solid #fff; box-sizing: border-box; border-radius: 8rpx; }
.consult-qr { display: block; width: 100%; }
.consult-image-state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; color: #667986; font-size: 26rpx; }
.consult-hold-tip { display: block; color: #315967; font-size: 26rpx; font-weight: 500; }
.consult-tip { display: block; margin: 16rpx 0; color: #667986; font-size: 24rpx; line-height: 1.65; text-align: center; }
.consult-save { height: 84rpx; line-height: 84rpx; margin: 0; border-radius: 14rpx; background: #377b9b; color: #fff; font-size: 28rpx; }
.consult-save[disabled] { background: #e7edf0; color: #7b8791; }
.consult-preview, .consult-retry { width: auto; display: inline-block; background: transparent; color: #377b9b; font-size: 25rpx; padding: 8rpx 24rpx; }
</style>
