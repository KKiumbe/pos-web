import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import UserProfile from './pages/UserProfile'
import Placeholder from './pages/Placeholder'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Placeholder title="Dashboard" />} />
          <Route path="/sales" element={<Placeholder title="Sales" />} />
          <Route path="/inventory" element={<Placeholder title="Inventory" />} />
          <Route path="/customers" element={<Placeholder title="Customers" />} />
          <Route path="/reports" element={<Placeholder title="Reports" />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
