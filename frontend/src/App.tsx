import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OrganizerDashboard from './pages/OrganizerDashboard'
import CreateEventPage from './pages/CreateEventPage'
import EventDetailPage from './pages/EventDetailPage'
import PhotoSearchPage from './pages/PhotoSearchPage'
import MyPhotosPage from './pages/MyPhotosPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children, requireOrganizer = false }: { children: React.ReactNode; requireOrganizer?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (requireOrganizer && user.role !== 'organizer' && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy via-navy-800 to-primary">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/90 font-medium">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/login" element={<Layout><LoginPage /></Layout>} />
      <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
      <Route path="/search" element={<ProtectedRoute><Layout><PhotoSearchPage /></Layout></ProtectedRoute>} />
      <Route path="/my-photos" element={<ProtectedRoute><Layout><MyPhotosPage /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/organizer" element={<ProtectedRoute requireOrganizer><Layout><OrganizerDashboard /></Layout></ProtectedRoute>} />
      <Route path="/organizer/events/new" element={<ProtectedRoute requireOrganizer><Layout><CreateEventPage /></Layout></ProtectedRoute>} />
      <Route path="/organizer/events/:eventId" element={<ProtectedRoute requireOrganizer><Layout><EventDetailPage /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
