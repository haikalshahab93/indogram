import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Feed from './pages/Feed'
import Composer from './pages/Composer'
import Profile from './pages/Profile'
import Explore from './pages/Explore'
import UserProfile from './pages/UserProfile.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Search from './pages/Search.jsx'
import { useApp } from './context/AppContext.jsx'
import './App.css'

function RequireAuth({ children }){
  const { token } = useApp()
  if(!token) return <Navigate to="/login" replace />
  return children
}

 function App() {
  const { token } = useApp()
  return (
    <BrowserRouter>
      <div className={`app-container ${token ? 'authed' : 'guest'}`}>
        {token && <Navbar />}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<RequireAuth><Feed /></RequireAuth>} />
            <Route path="/compose" element={<RequireAuth><Composer /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/explore" element={<RequireAuth><Explore /></RequireAuth>} />
            <Route path="/user/:username" element={<RequireAuth><UserProfile /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
 }

export default App
