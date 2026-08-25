<template>
  <view class="page">
    <view v-if="patients.length" class="patient-list">
      <view v-for="patient in patients" :key="patient.id" class="patient-card">
        <view class="patient-main">
          <view class="patient-heading">
            <text class="patient-name">{{ patient.name }}</text>
            <text class="patient-type" :class="patient.patientType">
              {{ patient.patientType === 'child' ? '儿童' : '成人' }}
            </text>
          </view>
          <text class="patient-meta">
            {{ patient.gender || '未知' }} · {{ patient.age ?? '--' }}岁
          </text>
          <text class="patient-meta">
            {{ patient.idType || '证件' }} {{ patient.idNumberMasked || '未完善' }}
          </text>
          <text v-if="patient.phoneMasked" class="patient-meta">
            联系电话 {{ patient.phoneMasked }}
          </text>
        </view>
        <view class="patient-actions">
          <button class="action-btn edit" @click="editPatient(patient.id)">编辑</button>
          <button class="action-btn delete" @click="confirmDelete(patient)">删除</button>
        </view>
      </view>
    </view>

    <view v-else-if="!loading" class="empty-state">
      <text class="empty-title">还没有就诊人</text>
      <text class="empty-desc">添加本人或家庭成员后，可用于复诊和处方。</text>
    </view>

    <view class="footer">
      <button class="add-btn" @click="addPatient">添加就诊人</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { deletePatient, getPatientList } from '@/api/patient.js'

const patients = ref([])
const loading = ref(false)

const loadPatients = async () => {
  loading.value = true
  try {
    const result = await getPatientList()
    patients.value = Array.isArray(result) ? result : []
  } catch (error) {
    console.error('加载就诊人失败:', error)
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const addPatient = () => {
  uni.navigateTo({ url: '/pages/dispense/patient_edit' })
}

const editPatient = (id) => {
  uni.navigateTo({ url: `/pages/dispense/patient_edit?id=${encodeURIComponent(id)}` })
}

const confirmDelete = (patient) => {
  uni.showModal({
    title: '删除就诊人',
    content: `确定删除“${patient.name}”吗？历史问诊和处方不会受影响。`,
    success: async (result) => {
      if (!result.confirm) return
      try {
        await deletePatient(patient.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        await loadPatients()
      } catch (error) {
        uni.showToast({ title: error?.message || '删除失败', icon: 'none' })
      }
    }
  })
}

onShow(loadPatients)
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx 180rpx;
  background: #f5f7fa;
}

.patient-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.patient-card {
  padding: 28rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(30, 52, 77, 0.05);
}

.patient-heading {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.patient-name {
  color: #1f2937;
  font-size: 32rpx;
  font-weight: 600;
}

.patient-type {
  padding: 4rpx 14rpx;
  color: #1768b0;
  font-size: 22rpx;
  background: #e8f3ff;
  border-radius: 999rpx;
}

.patient-type.child {
  color: #a15c00;
  background: #fff3dc;
}

.patient-meta {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 26rpx;
}

.patient-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #edf0f3;
}

.action-btn {
  margin: 0;
  padding: 0 26rpx;
  color: #1768b0;
  font-size: 26rpx;
  line-height: 60rpx;
  background: #eef6ff;
  border-radius: 999rpx;
}

.action-btn::after {
  border: none;
}

.action-btn.delete {
  color: #d14343;
  background: #fff1f1;
}

.empty-state {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding-top: 220rpx;
}

.empty-title {
  color: #374151;
  font-size: 32rpx;
  font-weight: 600;
}

.empty-desc {
  margin-top: 18rpx;
  color: #9ca3af;
  font-size: 26rpx;
}

.footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -8rpx 24rpx rgba(30, 52, 77, 0.06);
}

.add-btn {
  color: #fff;
  font-size: 30rpx;
  background: #2a82e4;
  border-radius: 999rpx;
}

.add-btn::after {
  border: none;
}
</style>
