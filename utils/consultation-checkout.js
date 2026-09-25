const positiveId = value => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export const parseConsultationContext = (options = {}) => {
  const consultationId = positiveId(options.consultationId)
  const patientId = positiveId(options.patientId)
  return consultationId && patientId ? { consultationId, patientId } : null
}

export const requireConsultationPatient = (consultation, context) => {
  if (!context || Number(consultation?.id) !== context.consultationId ||
      Number(consultation?.patientId) !== context.patientId) {
    throw new Error('本次复诊与就诊人不一致，请重新申请复诊')
  }
  return context
}

// 处方 ID 与问诊 ID 属于不同表，必须沿真实外键查询。
export const loadPrescriptionContext = async (prescriptionId, api) => {
  const prescription = await api.getPrescriptionDetail(prescriptionId)
  if (!prescription || String(prescription.id) !== String(prescriptionId)) {
    throw new Error('处方信息不匹配')
  }
  const consultation = prescription.consultationId
    ? await api.getConsultationDetail(prescription.consultationId)
    : null
  return { prescription, consultation }
}

export const requireCreatedPrescription = (prescription, context) => {
  if (!positiveId(prescription?.id) ||
      Number(prescription.consultationId) !== context.consultationId ||
      Number(prescription.patientId) !== context.patientId) {
    throw new Error('未取得本次复诊处方，请重试')
  }
  return prescription
}
