<template>
  <view class="question-item">
    <view class="question-header">
      <text class="question-label">Q{{ index + 1 }}. {{ question.title }}</text>
      <text class="question-type">单选题</text>
    </view>
    <view class="options">
      <view v-for="option in question.options" :key="option.optionId" class="option-item"
        :class="{ active: question.selectedOptionId === option.optionId }"
        @click="selectOption(option.optionId)">
        <view class="radio">
          <view v-if="question.selectedOptionId === option.optionId" class="radio-inner"></view>
        </view>
        <text class="option-text">{{ option.optionText }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    question: { type: Object, required: true },
    index: { type: Number, required: true },
    disabled: { type: Boolean, default: false }
  },
  emits: ['select'],
  methods: {
    selectOption(optionId) {
      if (!this.disabled) this.$emit('select', optionId)
    }
  }
}
</script>

<style scoped>
.question-item { margin-bottom: 50rpx; }
.question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.question-label { font-size: 30rpx; font-weight: 500; color: #333333; }
.question-type { font-size: 24rpx; color: #FFB6C1; background-color: #FFF0F5; padding: 4rpx 12rpx; border-radius: 8rpx; }
.options { display: flex; flex-direction: column; }
.options .option-item { margin-bottom: 20rpx; }
.options .option-item:last-child { margin-bottom: 0; }
.option-item { display: flex; align-items: center; padding: 20rpx; background-color: #f9f9f9; border-radius: 12rpx; transition: all 0.3s; }
.option-item.active { background-color: #FFF0F5; }
.radio { width: 40rpx; height: 40rpx; border: 2rpx solid #cccccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; transition: all 0.3s; }
.option-item.active .radio { border-color: #FFB6C1; }
.radio-inner { width: 24rpx; height: 24rpx; background-color: #FFB6C1; border-radius: 50%; }
.option-text { font-size: 28rpx; color: #333333; }
</style>
