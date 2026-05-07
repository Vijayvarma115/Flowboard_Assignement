import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/projects', label: 'Projects', icon: '◫' },
  { to: '/discover', label: 'Discover', icon: '🔍' },
];

export default function Sidebar() {
  const {
    user,
    logout,
    isAdmin,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const announcedUnread = useRef(false);
  const visibleNavItems = isAdmin ? navItems.filter(i => i.to !== '/discover') : navItems;

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  useEffect(() => {
    if (!user || announcedUnread.current) return;
    if (unreadNotificationCount > 0) {
      addToast(`You have ${unreadNotificationCount} unread mention${unreadNotificationCount === 1 ? '' : 's'}`, 'warning');
      announcedUnread.current = true;
    }
  }, [user, unreadNotificationCount, addToast]);

  function navClass(isActive) {
    return isActive
      ? 'flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors bg-primary-50 text-primary-600'
      : 'flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900';
  }

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/95 backdrop-blur shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm shrink-0"><span className="text-white text-xs font-bold">F</span></div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-none truncate">FlowBoard</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">Team task manager</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen(true)} className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm active:scale-95 transition-transform" aria-label="Open navigation menu">☰</button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[88vw] max-w-[320px] h-full bg-white border-r border-gray-200 shadow-2xl flex flex-col">
            <div className="px-4 pt-5 pb-4 border-b border-gray-100 bg-gradient-to-b from-primary-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-500 flex items-center justify-center shadow-sm shrink-0"><span className="text-white text-sm font-bold">F</span></div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">FlowBoard</p>
                  <p className="text-xs text-gray-500 truncate">Navigate your workspace</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {visibleNavItems.map(item => (
                <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({isActive}) => navClass(isActive)}>
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0"><span className="text-white text-xs font-semibold">{(user?.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}</span></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                    <span className={isAdmin ? 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 bg-primary-100 text-primary-700' : 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 bg-gray-100 text-gray-600'}>{isAdmin ? 'ADMIN' : 'MEMBER'}</span>
                  </div>
                </div>
              </div>
            </nav>

            <div className="p-3 border-t border-gray-100 bg-white">
              <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"><span>↩</span> Sign out</button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-[220px] shrink-0 h-screen sticky top-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center"><span className="text-white text-xs font-bold">F</span></div>
            <span className="font-semibold text-gray-900 text-[15px]">FlowBoard</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleNavItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({isActive}) => navClass(isActive)}>
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="relative mb-3">
            <button
              type="button"
              onClick={() => setNotificationsOpen(open => !open)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>🔔</span>
                Notifications
              </span>
              {unreadNotificationCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-500 text-white text-[11px] font-semibold flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-20">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-700">Unread mentions</span>
                  {unreadNotificationCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead()}
                      className="text-[11px] font-medium text-primary-600 hover:text-primary-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-400">No unread notifications</div>
                  ) : notifications.map(notification => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={async () => {
                        await markNotificationRead(notification.id);
                        setNotificationsOpen(false);
                        navigate(notification.link || '/dashboard');
                      }}
                      className="w-full text-left px-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-[13px] font-medium text-gray-900 leading-snug">{notification.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{notification.message}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center shrink-0"><span className="text-white text-xs font-semibold">{initials}</span></div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{user?.name}</p>
              <span className={isAdmin ? 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 bg-primary-100 text-primary-700' : 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 bg-gray-100 text-gray-600'}>{isAdmin ? 'ADMIN' : 'MEMBER'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-1 w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"><span>↩</span> Sign out</button>
        </div>
      </aside>
    </>
  );
}
