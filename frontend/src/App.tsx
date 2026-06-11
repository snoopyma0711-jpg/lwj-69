import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/Login'
import ResidentLayout from './layouts/ResidentLayout'
import FrontdeskLayout from './layouts/FrontdeskLayout'
import TechnicianLayout from './layouts/TechnicianLayout'
import ResidentOrders from './pages/resident/Orders'
import ResidentSubmit from './pages/resident/Submit'
import FrontdeskKanban from './pages/frontdesk/Kanban'
import FrontdeskDashboard from './pages/frontdesk/Dashboard'
import TechnicianOrders from './pages/technician/Orders'

interface PrivateRouteProps {
  children: React.ReactNode
  role?: 'resident' | 'frontdesk' | 'technician'
}

function PrivateRoute({ children, role }: PrivateRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  
  if (role && user?.role !== role) {
    const targetPath = user?.role ? `/${user.role}` : '/login'
    return <Navigate to={targetPath} replace />
  }
  
  return <>{children}</>
}

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  const defaultRoutes: Record<string, string> = {
    resident: '/resident/orders',
    frontdesk: '/frontdesk/kanban',
    technician: '/technician/orders'
  }
  
  const target = defaultRoutes[user?.role || ''] || '/login'
  return <Navigate to={target} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      
      <Route
        path="/resident"
        element={
          <PrivateRoute role="resident">
            <ResidentLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<ResidentOrders />} />
        <Route path="submit" element={<ResidentSubmit />} />
      </Route>

      <Route
        path="/frontdesk"
        element={
          <PrivateRoute role="frontdesk">
            <FrontdeskLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="kanban" replace />} />
        <Route path="kanban" element={<FrontdeskKanban />} />
        <Route path="dashboard" element={<FrontdeskDashboard />} />
      </Route>

      <Route
        path="/technician"
        element={
          <PrivateRoute role="technician">
            <TechnicianLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<TechnicianOrders />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

export default App
