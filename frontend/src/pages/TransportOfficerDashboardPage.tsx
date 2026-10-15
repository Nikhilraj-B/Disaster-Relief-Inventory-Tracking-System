import { PageHeader } from '../components/Page'
import DashboardPage from './DashboardPage'
import SupplyRequestsPage from './SupplyRequestsPage'
import ShipmentsPage from './ShipmentsPage'

export default function TransportOfficerDashboardPage() {
  return (
    <div>
      <PageHeader title="Transport Officer Dashboard" />
      <DashboardPage />
      <div style={{ marginTop: '2rem' }}>
        <SupplyRequestsPage />
      </div>
      <div style={{ marginTop: '2rem' }}>
        <ShipmentsPage />
      </div>
    </div>
  )
}
