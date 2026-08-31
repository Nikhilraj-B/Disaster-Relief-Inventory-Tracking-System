export type Role =
  | 'GOVERNMENT_ADMIN'
  | 'WAREHOUSE_MANAGER'
  | 'CAMP_MANAGER'
  | 'NGO_COORDINATOR'
  | 'TRANSPORT_OFFICER'

export type FacilityType = 'WAREHOUSE' | 'CAMP'
export type OrganizationType = 'GOVT' | 'NGO'
export type ReliefItemCategory = 'FOOD' | 'MEDICINE' | 'WATER' | 'EQUIPMENT' | 'SHELTER' | 'CLOTHING' | 'OTHER'
export type SupplyRequestStatus =
  | 'NONE' | 'CREATED' | 'APPROVED' | 'ACCEPTED' | 'DISPATCHED'
  | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'COMPLETED' | 'REJECTED'
export type MlClassification = 'NORMAL' | 'ABNORMAL'

export interface AuthResponse {
  token: string
  tokenType: string
  userId: string
  email: string
  fullName: string
  role: Role
  walletAddress?: string
}

export interface User {
  id: string
  email: string
  role: Role
  walletAddress?: string
  fullName: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  cid?: string
}

export interface Organization {
  id: string
  name: string
  type: OrganizationType
  contactInfo?: string
  createdAt: string
  updatedAt: string
  cid?: string
}

export interface Facility {
  id: string
  organizationId: string
  name: string
  type: FacilityType
  location?: string
  managerUserId?: string
  population?: number
  maxCapacity?: number
  capacitySqm?: number
  createdAt: string
  updatedAt: string
  cid?: string
}

export interface ReliefItem {
  id: string
  name: string
  category: ReliefItemCategory
  unit?: string
  description?: string
  createdAt: string
  updatedAt: string
  cid?: string
}

export interface InventoryItem {
  id: string
  facilityId: string
  reliefItemId: string
  quantity: number
  reservedQuantity: number
  updatedAt: string
  cid?: string
}

export interface InventoryTransaction {
  id: string
  facilityId: string
  reliefItemId: string
  type: string
  quantity: number
  userId?: string
  createdAt: string
  cid?: string
}

export interface Vehicle {
  id: string
  organizationId: string
  registrationNumber: string
  vehicleType?: string
  capacityKg?: number
  active: boolean
  cid?: string
}

export interface Shipment {
  id: string
  supplyRequestId: string
  transporterUserId?: string
  vehicleId?: string
  dispatchTime?: string
  arrivalTime?: string
  txHashDispatch?: string
  cid?: string
}

export interface RequestItem {
  reliefItemId: string
  itemName: string
  itemCategory: ReliefItemCategory
  requestedQty: number
  fulfilledQty?: number
}

export interface SupplyRequest {
  id: string
  campId: string
  warehouseId: string
  status: SupplyRequestStatus
  mlClassification?: MlClassification
  mlConfidence?: number
  txHashCreate?: string
  txHashReceipt?: string
  txHashes?: Record<string, string>
  items: RequestItem[]
  createdBy?: string
  createdAt: string
  updatedAt: string
  cid?: string
}

export interface Approval {
  id: string
  supplyRequestId: string
  approverUserId: string
  decision: string
  comments?: string
  txHash?: string
  createdAt: string
  cid?: string
}

export interface Notification {
  id: string
  userId: string
  message: string
  read: boolean
  createdAt: string
  cid?: string
}

export interface AuditRecord {
  id: string
  action: string
  actorUserId?: string
  entityType?: string
  entityId?: string
  details?: string
  txHash?: string
  createdAt: string
  cid?: string
}
