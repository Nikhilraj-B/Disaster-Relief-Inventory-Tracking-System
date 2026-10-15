import { PageHeader } from '../components/Page'
import DashboardPage from './DashboardPage'
import InventoryPage from './InventoryPage'
import SupplyRequestsPage from './SupplyRequestsPage'

export default function WarehouseManagerDashboardPage() {
  return (
    <div>
      <PageHeader title="Warehouse Manager Dashboard" />
      <DashboardPage />
      <div style={{ marginTop: '2rem' }}>
        <InventoryPage />
      </div>
      <div style={{ marginTop: '2rem' }}>
        <SupplyRequestsPage />
      </div>
    </div>
  )
}
