export type Role =
  | 'ADMIN'
  | 'WAREHOUSE_MANAGER'
  | 'CAMP_MANAGER'
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
  facilityId?: string
}

export interface User {
  id: string
  email: string
  role: Role
  walletAddress?: string
  fullName: string
  facilityId?: string
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
  facilityId?: string
  inventoryItemId?: string
  reliefItemId?: string
  type?: string
  transactionType?: 'ADD' | 'SUBTRACT' | 'RESERVE' | 'RELEASE'
  quantity: number
  userId?: string
  referenceType?: string
  createdAt: string
  cid?: string
}

export interface Vehicle {
  id: string
  organizationId: string
  warehouseId?: string
  transportOfficerUserId?: string
  registrationNumber: string
  vehicleType?: string
  capacityKg?: number
  driverName?: string
  driverId?: string
  active: boolean
  cid?: string
}

export interface Shipment {
  id: string
  supplyRequestId: string
  transporterUserId?: string
  vehicleId?: string
  driverName?: string
  driverId?: string
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
  warehouseId?: string
  status: SupplyRequestStatus
  mlClassification?: MlClassification
  mlConfidence?: number
  txHashCreate?: string
  txHashReceipt?: string
  txHashes?: Record<string, string>
  items: RequestItem[]
  createdBy?: string
  acceptedByManagerId?: string
  assignedVehicleId?: string
  assignedDriverName?: string
  assignedDriverId?: string
  assignedTransporterId?: string
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
