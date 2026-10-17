// null explicitly means quantity is not counted. Missing fields may use the previous snapshot.
export const inventoryFields = (value = {}, fallback = {}) => {
  const inventoryMode = value.inventoryMode ?? fallback.inventoryMode ?? 'LOCAL_COUNT'
  const inventoryStatus = value.inventoryStatus ?? fallback.inventoryStatus
  return {
    inventoryMode,
    inventoryStatus,
    inventoryReason: value.inventoryReason ?? fallback.inventoryReason,
    inventoryCheckedAt: value.inventoryCheckedAt ?? fallback.inventoryCheckedAt,
    available: inventoryMode === 'HIS_AVAILABILITY'
      ? inventoryStatus === 'AVAILABLE' && (value.available ?? fallback.available) === true
      : (value.available ?? fallback.available)
  }
}

export const inventoryStock = (value, fallback = 0) => {
  if (value === null) return null
  if (value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback
}
