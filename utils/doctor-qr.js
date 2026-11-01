// 下载与保存分别确认成功，网络失败不能误报保存完成；权限仅在用户点击保存后申请。
export const saveDoctorQr = async (url) => {
  if (!url || !/^https:\/\//i.test(url)) throw new Error('问诊二维码地址无效，请联系医院更新')
  const filePath = await new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: result => result.statusCode === 200 && result.tempFilePath
        ? resolve(result.tempFilePath) : reject(new Error('二维码下载失败，请重试')),
      fail: () => reject(new Error('二维码下载失败，请检查网络后重试'))
    })
  })
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath, success: resolve,
      fail: error => {
        const message = error?.errMsg || ''
        const privacyDenied = /privacy/i.test(message)
        const denied = !privacyDenied && /auth deny|auth denied|authorize.*denied|permission|authorize no response/i.test(message)
        const result = new Error(privacyDenied ? '请先完成小程序隐私授权后重试' : denied ? '请允许保存图片到相册后重试' : '图片未保存，请重试')
        result.permissionDenied = denied
        reject(result)
      }
    })
  })
}
