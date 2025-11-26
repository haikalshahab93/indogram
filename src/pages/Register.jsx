import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function Register(){
  const { register, token } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [nameid, setNameid] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e)=>{
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await register(username, password, nameid)
    setLoading(false)
    if(res?.ok){ navigate('/profile') }
    else setError(res?.error || 'Gagal mendaftar')
  }

  if(token){
    return (
      <section className="auth auth-logged">
        <h2>Sudah masuk</h2>
        <p>Anda sudah masuk. Buka halaman Profil.</p>
      </section>
    )
  }

  return (
    <section className="auth">
      <div className="auth-card">
        <h1 className="auth-brand">Indogram</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <input className="auth-input" placeholder="Nama pengguna" value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" />
          <input className="auth-input" placeholder="Name ID" value={nameid} onChange={(e)=>setNameid(e.target.value)} />
          <input className="auth-input" type="password" placeholder="Kata sandi" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" />
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading || !username || !password}>{loading? 'Memproses...' : 'Daftar'}</button>
        </form>
        <div className="auth-divider">ATAU</div>
        <button className="auth-facebook" type="button" onClick={(e)=>e.preventDefault()}>Daftar dengan Facebook</button>
        <div className="auth-links-inline">
          Sudah punya akun? <a href="/login">Masuk</a>
        </div>
      </div>
    </section>
  )
}