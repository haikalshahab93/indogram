import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import './Notifications.css'

export default function Notifications(){
-  const { notifications, notificationsLoading, markNotificationRead, respondInvite, respondFriendInvite } = useApp()
+  const { notifications, notificationsLoading, fetchNotifications, markNotificationRead, respondInvite, respondFriendInvite } = useApp()
   useEffect(()=>{ fetchNotifications() }, [])

  const groups = {
    Today: [],
    Yesterday: [],
    'This week': [],
  }
  const now = new Date()
  const isToday = (d)=>{
    const n = new Date(d)
    return n.toDateString() === now.toDateString()
  }
  const isYesterday = (d)=>{
    const n = new Date(d)
    const y = new Date(now)
    y.setDate(now.getDate()-1)
    return n.toDateString() === y.toDateString()
  }
  ;(notifications||[]).forEach(n=>{
    if(isToday(n.createdAt)) groups.Today.push(n)
    else if(isYesterday(n.createdAt)) groups.Yesterday.push(n)
    else groups['This week'].push(n)
  })

  const onRespond = async (groupId, action)=>{
    await respondInvite(groupId, action)
  }
  const onRespondFriend = async (notifId, action)=>{
    await respondFriendInvite(notifId, action)
  }

  const actorName = (n)=> (n.type === 'group_invite' || n.type === 'friend_invite') ? (n.data?.inviter || 'Someone') : (n.data?.invitee || 'Someone')
  const messageText = (n)=>{
    switch(n.type){
      case 'group_invite':
        return `invited you to join ${n.data?.groupName || 'the group'}`
      case 'group_invite_accepted':
        return `accepted your invite to ${n.data?.groupName || 'the group'}`
      case 'group_invite_declined':
        return `declined your invite to ${n.data?.groupName || 'the group'}`
      case 'friend_invite':
        return 'invited you to be friends'
      case 'friend_invite_accepted':
        return 'accepted your friend invite'
      case 'friend_invite_declined':
        return 'declined your friend invite'
      default:
        return n.message || ''
    }
  }

  return (
    <div className="notif-page">
      <div className="notif-header">
        <h2 className="notif-title">Notifications</h2>
        {notifications.length>0 && (
        <button className="notif-btn" onClick={async()=>{
        const unread = notifications.filter(n=>!n.read)
        for(const n of unread){ await markNotificationRead(n.id) }
        }}>Mark all as read</button>
        )}
        </div>
        {notificationsLoading && (
        <div className="notif-skeletons">
        {[...Array(4)].map((_,i)=> (
        <div className="notif-item skeleton" key={`sk-${i}`}>
        <div className="notif-avatar skeleton-box"/>
        <div className="notif-content">
        <div className="notif-title skeleton-line"/>
        <div className="notif-meta skeleton-line short"/>
        </div>
        </div>
        ))}
        </div>
        )}
       {Object.entries(groups).map(([title, arr])=> (
         <section key={title} className="notif-section">
           <h3 className="notif-section-title">{title}</h3>
           <ul className="notif-list">
             {arr.length === 0 && (
               <li className="notif-empty">No notifications</li>
             )}
             {arr.map(n => (
               <li key={n.id} className={`notif-item${n.unread ? ' unread' : ''}`}>
                 <div className="notif-avatar-wrap">
                   {n.avatar ? (
                     <img className="notif-avatar" src={n.avatar} alt="" />
                   ) : (
                     <div className="notif-avatar placeholder" />
                   )}
                 </div>
                 <div className="notif-content">
                   <div className="notif-text">
                     <strong className="notif-actor">{actorName(n)}</strong>
                     <span className="notif-message"> {messageText(n)}</span>
                   </div>
                   <div className="notif-meta">
                     <time className="notif-time">{new Date(n.createdAt).toLocaleString()}</time>
                     {n.unread && (
                       <button className="notif-mark" onClick={()=> markNotificationRead(n.id)}>Mark as read</button>
                     )}
                   </div>
                   {/* Invite respond controls for pending group invites */}
                   {n.type === 'group_invite' && n.data?.groupId && (
                     <div className="notif-actions">
                       <button className="notif-action accept" onClick={()=> onRespond(n.data.groupId, 'accept')}>Accept</button>
                       <button className="notif-action decline" onClick={()=> onRespond(n.data.groupId, 'decline')}>Decline</button>
                     </div>
                   )}
                   {/* Invite respond controls for pending friend invites */}
                   {n.type === 'friend_invite' && (
                     <div className="notif-actions">
                       <button className="notif-action accept" onClick={()=> onRespondFriend(n.id, 'accept')}>Accept</button>
                       <button className="notif-action decline" onClick={()=> onRespondFriend(n.id, 'decline')}>Decline</button>
                     </div>
                   )}
                   {/* Status indicator for accepted/declined notifications sent to inviter */}
                   {(n.type === 'group_invite_accepted' || n.type === 'group_invite_declined' || n.type === 'friend_invite_accepted' || n.type === 'friend_invite_declined') && (
                     <div className="notif-actions">
                       <span className={`notif-status ${n.type.endsWith('_accepted') ? 'accepted' : 'declined'}`}>{n.type.endsWith('_accepted') ? 'Accepted' : 'Declined'}</span>
                     </div>
                   )}
                 </div>
               </li>
             ))}
           </ul>
         </section>
       ))}
     </div>
   )
 }
-{notificationsLoading && (
-  <div className="notif-skeletons">
-    {[...Array(4)].map((_,i)=> (
-      <div className="notif-item skeleton" key={`sk-${i}}`}>
-        <div className="notif-avatar skeleton-box"/>
-        <div className="notif-content">
-          <div className="notif-title skeleton-line"/>
-          <div className="notif-meta skeleton-line short"/>
-        </div>
-      </div>
-    ))}
-  </div>
-)}
-<div className="notif-header">
-  <h2>Notifications</h2>
-  {notifications.length>0 && (
-    <button className="btn btn-light" onClick={async()=>{
-      const unread = notifications.filter(n=>!n.read)
-      for(const n of unread){ await markNotificationRead(n.id) }
-    }}>Mark all as read</button>
-  )}
-</div>