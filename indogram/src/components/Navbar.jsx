import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'
import { useApp } from '../context/AppContext.jsx'

export default function Navbar() {
  const { token, logout, notifications } = useApp()
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => n?.unread).length : 0
  return (
    <header className="">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <img src="/indogram.svg" alt="Indogram" className="brand-icon" />
          <span className="brand-text">Indogram</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </span>
            <span className="label">Home</span>
          </NavLink>
          <NavLink to="/search" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.5-1.5-5-5zM9.5 14A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z"/></svg>
            </span>
            <span className="label">Search</span>
          </NavLink>
          <NavLink to="/explore" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M10.5 3a7.5 7.5 0 015.96 12.11l4.21 4.21-1.42 1.42-4.21-4.21A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/></svg>
            </span>
            <span className="label">Explore</span>
          </NavLink>
          <Link to="#" className="nav-item" onClick={(e)=> e.preventDefault()}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm3 0l3 4H4l3-4zm10 0l3 4h-6l3-4zM8 10h8v8H8v-8z"/></svg>
            </span>
            <span className="label">Reels</span>
          </Link>
          <Link to="#" className="nav-item" onClick={(e)=> e.preventDefault()}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 2H4a2 2 0 00-2 2v14l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>
            </span>
            <span className="label">Messages</span>
          </Link>
          <NavLink to="/notifications" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true" style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z"/></svg>
              {unreadCount > 0 && (<span className="notif-badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span>)}
            </span>
            <span className="label">Notifications</span>
          </NavLink>
          <NavLink to="/compose" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            </span>
            <span className="label">Create</span>
          </NavLink>

          {/* Footer items moved under Create for desktop order */}
          <NavLink to="/groups" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>
            </span>
            <span className="label">Groups</span>
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>
            </span>
            <span className="label">Profile</span>
          </NavLink>
          <button type="button" className="nav-item">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M5 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
            </span>
            <span className="label">More</span>
          </button>
          {token && (
            <button onClick={logout} className="nav-item">
              <span className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M10 17l5-5-5-5v3H3v4h7v3zM20 3h-8v2h8v14h-8v2h8a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>
              </span>
              <span className="label">Logout</span>
            </button>
          )}
        </nav>

        {/* Remove separate nav-footer block to avoid duplication */}
        {/* ... */}
      </div>
    </header>
  )
}